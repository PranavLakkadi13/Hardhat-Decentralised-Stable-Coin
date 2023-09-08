const networkConfig = {
  11155111: {
    name: "sepolia",
    weth: "0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92",
    wbtc: "0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92", // couldnt find wBTC contract address so used weth again
    ethUsd: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    btcusd: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
  },
  80001: {
    name: "polygon",
    weth: "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    wbtc: "0xd14Eb7DaB24082Edd6a4202e15E3bbD7ceaD5c6F",
    ethUsd: "0x0715A7794a1dc8e42615F059dD6e406A6594651A",
    btcusd: "0x007A22900a3B98143368Bd5906f8E17e9867581b",
  },
};

const developmentChain = ["hardhat", "localhost"];

const decimals = 8;

const initialAnswer = 2000_00000000;

const initialAnswerBTC = 30000_00000000;

module.exports = {
  networkConfig,
  developmentChain,
  decimals,
  initialAnswer,
  initialAnswerBTC,
};
