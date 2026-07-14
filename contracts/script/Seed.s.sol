// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {EstateFund} from "../src/EstateFund.sol";

/// @notice Seeds the demo estate with REAL testnet transactions (no fixtures).
/// Requires an already-deployed EstateFund (set FUND_ADDRESS) and three funded wallets.
///
/// Usage:
///   FUND_ADDRESS=0x... forge script script/Seed.s.sol \
///     --rpc-url $MONAD_RPC_URL --broadcast --slow
///
/// Because expense #0 must wait out the on-chain delay window before it can be executed,
/// run this in TWO passes:
///   PASS=1 (default) creates the estate, joins residents, pays levies, proposes both
///          expenses, and lodges resident1's objection on expense #1.
///   PASS=2 executes expense #0 after the 120s delay has elapsed.
contract Seed is Script {
    function run() external {
        EstateFund fund = EstateFund(payable(vm.envAddress("FUND_ADDRESS")));
        uint256 pass = vm.envOr("PASS", uint256(1));

        uint256 chairmanPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 r1Pk = vm.envUint("RESIDENT1_PRIVATE_KEY");
        uint256 r2Pk = vm.envUint("RESIDENT2_PRIVATE_KEY");

        if (pass == 1) {
            _pass1(fund, chairmanPk, r1Pk, r2Pk);
        } else {
            _pass2(fund, chairmanPk);
        }
    }

    function _pass1(EstateFund fund, uint256 chairmanPk, uint256 r1Pk, uint256 r2Pk) internal {
        // 1. Chairman creates the estate.
        vm.startBroadcast(chairmanPk);
        uint256 id = fund.createEstate("Peace Court Estate, Abuja", keccak256("sunrise-04"), 120);
        console.log("Estate id:", id);
        vm.stopBroadcast();

        // 2. Residents join.
        vm.broadcast(r1Pk);
        fund.joinEstate(id, "sunrise-04", "Block A, Flat 2");
        vm.broadcast(r2Pk);
        fund.joinEstate(id, "sunrise-04", "Block C, Flat 7");

        // 3. Levies.
        vm.broadcast(chairmanPk);
        fund.payLevy{value: 0.05 ether}(id, "July 2026");
        vm.broadcast(r1Pk);
        fund.payLevy{value: 0.05 ether}(id, "July 2026");
        vm.broadcast(r2Pk);
        fund.payLevy{value: 0.03 ether}(id, "July 2026 (partial)");

        // 4. Expense #0 — will be executed in pass 2 after the delay.
        vm.broadcast(chairmanPk);
        fund.proposeExpense(id, vm.addr(r2Pk), 0.06 ether, "Diesel - 500L - July");

        // 5. Expense #1 — objected to, left pending for the demo.
        vm.broadcast(chairmanPk);
        fund.proposeExpense(id, vm.addr(r1Pk), 0.02 ether, "Gate repair - welder");
        vm.broadcast(r1Pk);
        fund.objectToExpense(id, 1);

        console.log("Pass 1 complete. Wait 120s, then run with PASS=2 to execute expense #0.");
    }

    function _pass2(EstateFund fund, uint256 chairmanPk) internal {
        uint256 id = fund.estateCount() - 1; // most recent estate
        vm.broadcast(chairmanPk);
        fund.executeExpense(id, 0);
        console.log("Pass 2 complete. Expense #0 executed (SETTLED).");
    }
}
