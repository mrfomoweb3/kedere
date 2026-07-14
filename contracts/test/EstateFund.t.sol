// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EstateFund} from "../src/EstateFund.sol";

/// @dev Malicious recipient that tries to re-enter executeExpense during payout.
contract ReentrantRecipient {
    EstateFund public fund;
    uint256 public estateId;
    uint256 public expenseId;
    bool public attacked;

    constructor(EstateFund _fund) {
        fund = _fund;
    }

    function arm(uint256 _estateId, uint256 _expenseId) external {
        estateId = _estateId;
        expenseId = _expenseId;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // attempt re-entry; should fail (guard + already-executed)
            fund.executeExpense(estateId, expenseId);
        }
    }
}

contract EstateFundTest is Test {
    EstateFund fund;

    address chairman = makeAddr("chairman");
    address alice = makeAddr("alice"); // resident 1
    address bob = makeAddr("bob"); // resident 2
    address carol = makeAddr("carol"); // resident 3
    address stranger = makeAddr("stranger");
    address vendor = makeAddr("vendor");

    string constant CODE = "sunrise-04";
    uint64 constant DELAY = 120;

    function setUp() public {
        fund = new EstateFund();
        vm.deal(chairman, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    // ------------------------------------------------------------- helpers

    function _create() internal returns (uint256 id) {
        vm.prank(chairman);
        id = fund.createEstate("Peace Court Estate", keccak256(bytes(CODE)), DELAY);
    }

    function _join(uint256 id, address who, string memory unit) internal {
        vm.prank(who);
        fund.joinEstate(id, CODE, unit);
    }

    function _pay(uint256 id, address who, uint256 amt) internal {
        vm.prank(who);
        fund.payLevy{value: amt}(id, "July 2026");
    }

    // -------------------------------------------------- creation & membership

    function test_createEstate_setsFields() public {
        uint256 id = _create();
        (string memory name, address chair,, uint256 count, uint64 delay, bool exists) =
            fund.estates(id);
        assertEq(name, "Peace Court Estate");
        assertEq(chair, chairman);
        assertEq(delay, DELAY);
        assertEq(count, 1); // chairman auto-registered
        assertTrue(exists);
        assertEq(fund.estateCount(), 1);
    }

    function test_chairmanIsAutoResident() public {
        uint256 id = _create();
        assertTrue(fund.isResident(id, chairman));
    }

    function test_joinEstate_correctCode() public {
        uint256 id = _create();
        _join(id, alice, "Block A, Flat 2");
        assertTrue(fund.isResident(id, alice));
        (string memory unit, bool active) = fund.residents(id, alice);
        assertEq(unit, "Block A, Flat 2");
        assertTrue(active);
    }

    function test_joinEstate_wrongCode_reverts() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert("bad code");
        fund.joinEstate(id, "wrong-code", "Block A, Flat 2");
    }

    function test_doubleJoin_reverts() public {
        uint256 id = _create();
        _join(id, alice, "Block A, Flat 2");
        vm.prank(alice);
        vm.expectRevert("already a resident");
        fund.joinEstate(id, CODE, "Block A, Flat 2");
    }

    function test_createEstate_badDelay_reverts() public {
        vm.startPrank(chairman);
        vm.expectRevert("bad delay");
        fund.createEstate("X", keccak256(bytes(CODE)), 59);
        vm.expectRevert("bad delay");
        fund.createEstate("X", keccak256(bytes(CODE)), 7 days + 1);
        vm.stopPrank();
    }

    // ----------------------------------------------------------------- levy

    function test_payLevy_increasesBalance_emits() public {
        uint256 id = _create();
        _join(id, alice, "Block A, Flat 2");
        vm.expectEmit(true, true, false, true);
        emit EstateFund.LevyPaid(id, alice, 1 ether, "July 2026", "Block A, Flat 2");
        _pay(id, alice, 1 ether);
        (,, uint256 balance,,,) = fund.estates(id);
        assertEq(balance, 1 ether);
        assertEq(address(fund).balance, 1 ether);
    }

    function test_payLevy_nonResident_reverts() public {
        uint256 id = _create();
        vm.prank(stranger);
        vm.expectRevert("not a resident");
        fund.payLevy{value: 1 ether}(id, "July 2026");
    }

    function test_payLevy_zeroValue_reverts() public {
        uint256 id = _create();
        _join(id, alice, "Block A, Flat 2");
        vm.prank(alice);
        vm.expectRevert("zero value");
        fund.payLevy{value: 0}(id, "July 2026");
    }

    function test_twoResidents_accumulate() public {
        uint256 id = _create();
        _join(id, alice, "A");
        _join(id, bob, "B");
        _pay(id, alice, 1 ether);
        _pay(id, bob, 2 ether);
        (,, uint256 balance,,,) = fund.estates(id);
        assertEq(balance, 3 ether);
    }

    // ------------------------------------------------------------ proposals

    function test_propose_emitsMemoAndExecutableAt() public {
        uint256 id = _create();
        _pay(id, chairman, 5 ether);
        uint64 nowTs = uint64(block.timestamp);
        vm.expectEmit(true, true, false, true);
        emit EstateFund.ExpenseProposed(id, 0, vendor, 1 ether, "Diesel", nowTs + DELAY);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
    }

    function test_propose_nonChairman_reverts() public {
        uint256 id = _create();
        _join(id, alice, "A");
        _pay(id, alice, 5 ether);
        vm.prank(alice);
        vm.expectRevert("not chairman");
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
    }

    function test_propose_aboveBalance_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 1 ether);
        vm.prank(chairman);
        vm.expectRevert("bad amount");
        fund.proposeExpense(id, vendor, 2 ether, "Diesel");
    }

    function test_propose_emptyMemo_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 1 ether);
        vm.prank(chairman);
        vm.expectRevert("empty memo");
        fund.proposeExpense(id, vendor, 1 ether, "");
    }

    function test_propose_zeroRecipient_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 1 ether);
        vm.prank(chairman);
        vm.expectRevert("zero recipient");
        fund.proposeExpense(id, address(0), 1 ether, "Diesel");
    }

    // ------------------------------------------------------ delay & execution

    function test_execute_beforeDelay_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.prank(chairman);
        vm.expectRevert("still in delay");
        fund.executeExpense(id, 0);
    }

    function test_execute_afterDelay_transfers() public {
        uint256 id = _create();
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.warp(block.timestamp + DELAY);
        uint256 vendorBefore = vendor.balance;
        vm.prank(chairman);
        fund.executeExpense(id, 0);
        assertEq(vendor.balance, vendorBefore + 1 ether);
        (,, uint256 balance,,,) = fund.estates(id);
        assertEq(balance, 1 ether);
    }

    function test_doubleExecute_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.warp(block.timestamp + DELAY);
        vm.prank(chairman);
        fund.executeExpense(id, 0);
        vm.prank(chairman);
        vm.expectRevert("not pending");
        fund.executeExpense(id, 0);
    }

    function test_executeCancelled_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.prank(chairman);
        fund.cancelExpense(id, 0);
        vm.warp(block.timestamp + DELAY);
        vm.prank(chairman);
        vm.expectRevert("not pending");
        fund.executeExpense(id, 0);
    }

    function test_execute_nonChairman_reverts() public {
        uint256 id = _create();
        _join(id, alice, "A");
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.warp(block.timestamp + DELAY);
        vm.prank(alice);
        vm.expectRevert("not chairman");
        fund.executeExpense(id, 0);
    }

    function test_reentrancy_blocked() public {
        uint256 id = _create();
        ReentrantRecipient attacker = new ReentrantRecipient(fund);
        _pay(id, chairman, 5 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, address(attacker), 1 ether, "Diesel");
        attacker.arm(id, 0);
        vm.warp(block.timestamp + DELAY);
        // The inner re-entrant call reverts, which bubbles up and fails the transfer.
        vm.prank(chairman);
        vm.expectRevert();
        fund.executeExpense(id, 0);
        // Fund not drained: nothing left the contract.
        assertEq(address(fund).balance, 5 ether);
    }

    // ------------------------------------------------------------ objections

    function test_object_onceThenReverts() public {
        uint256 id = _create();
        _join(id, alice, "A");
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.prank(alice);
        fund.objectToExpense(id, 0);
        vm.prank(alice);
        vm.expectRevert("already objected");
        fund.objectToExpense(id, 0);
    }

    function test_object_nonResident_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.prank(stranger);
        vm.expectRevert("not a resident");
        fund.objectToExpense(id, 0);
    }

    function test_object_afterWindow_reverts() public {
        uint256 id = _create();
        _join(id, alice, "A");
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.warp(block.timestamp + DELAY);
        vm.prank(alice);
        vm.expectRevert("window closed");
        fund.objectToExpense(id, 0);
    }

    function test_majorityObjection_autoCancels() public {
        // 3 residents (chairman + alice + bob); 2 objections is a strict majority.
        uint256 id = _create();
        _join(id, alice, "A");
        _join(id, bob, "B");
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.prank(alice);
        fund.objectToExpense(id, 0);
        vm.expectEmit(true, true, false, true);
        emit EstateFund.ExpenseCancelled(id, 0, "majority objection");
        vm.prank(bob);
        fund.objectToExpense(id, 0);
        EstateFund.Expense memory e = fund.getExpense(id, 0);
        assertTrue(e.cancelled);
    }

    function test_minorityObjection_stillExecutes() public {
        // 3 residents; 1 objection is a minority — execution still succeeds after delay.
        uint256 id = _create();
        _join(id, alice, "A");
        _join(id, bob, "B");
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        vm.prank(alice);
        fund.objectToExpense(id, 0);
        vm.warp(block.timestamp + DELAY);
        vm.prank(chairman);
        fund.executeExpense(id, 0);
        EstateFund.Expense memory e = fund.getExpense(id, 0);
        assertTrue(e.executed);
        assertFalse(e.cancelled);
    }

    // --------------------------------------------------------------- receive

    function test_directTransfer_reverts() public {
        uint256 id = _create();
        _pay(id, chairman, 1 ether); // ensure estate exists / has funds
        vm.prank(chairman);
        (bool ok,) = address(fund).call{value: 1 ether}("");
        assertFalse(ok); // receive() reverts with "use payLevy"
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_payLevy_accounting(uint96 a, uint96 b) public {
        vm.assume(a > 0 && b > 0);
        uint256 id = _create();
        _join(id, alice, "A");
        _join(id, bob, "B");
        vm.deal(alice, a);
        vm.deal(bob, b);
        _pay(id, alice, a);
        _pay(id, bob, b);
        (,, uint256 balance,,,) = fund.estates(id);
        assertEq(balance, uint256(a) + uint256(b));
        assertEq(address(fund).balance, uint256(a) + uint256(b));
    }

    function testFuzz_delayGate_respected(uint64 delay, uint64 elapsed) public {
        delay = uint64(bound(delay, fund.MIN_DELAY(), fund.MAX_DELAY()));
        elapsed = uint64(bound(elapsed, 0, 14 days));
        vm.prank(chairman);
        uint256 id = fund.createEstate("E", keccak256(bytes(CODE)), delay);
        _pay(id, chairman, 2 ether);
        vm.prank(chairman);
        fund.proposeExpense(id, vendor, 1 ether, "Diesel");
        uint256 start = block.timestamp;
        vm.warp(start + elapsed);
        if (elapsed < delay) {
            vm.prank(chairman);
            vm.expectRevert("still in delay");
            fund.executeExpense(id, 0);
        } else {
            vm.prank(chairman);
            fund.executeExpense(id, 0);
            EstateFund.Expense memory e = fund.getExpense(id, 0);
            assertTrue(e.executed);
        }
    }
}
