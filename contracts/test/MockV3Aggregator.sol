// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@chainlink/contracts/src/v0.6/tests/MockV3Aggregator.sol";

contract MockV3Aggregator1 is MockV3Aggregator {
    constructor(uint8 decimal, int256 price) MockV3Aggregator(decimal,price) public {}

    function updateRoundData(
    uint80 /*_roundId,*/,
    int256 _answer ,
    uint256 /* _timestamp */,
    uint256 /* _startedAt */
  ) public override {
    // latestRound = _roundId;
    latestAnswer = _answer;
    // latestTimestamp = _timestamp;
    getAnswer[latestRound] = _answer;
    // getTimestamp[latestRound] = _timestamp;
    // getStartedAt[latestRound] = _startedAt;
  }

}