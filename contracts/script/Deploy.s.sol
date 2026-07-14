// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {EstateFund} from "../src/EstateFund.sol";

/// @notice Deploys EstateFund to Monad testnet.
/// forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast
contract Deploy is Script {
    function run() external returns (EstateFund fund) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        fund = new EstateFund();
        vm.stopBroadcast();
        console.log("EstateFund deployed at:", address(fund));
    }
}
