// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Decentralised Stable Coin 
 * @author Pranav Lakkadi 
 * Collateral : Exogenous
 * Minting : Algorithmic 
 * Relative Stability : Pegged to USD
 * 
 * 
 * This is a Contract that is meant to be goverened bu the DSCEngine.sol . This is Just a ERC20
   implementation of the StableCoin
 */ 
contract DecentralisedStableCoin is ERC20Burnable,Ownable{

  error DecentralisedStableCoin__MustBeMoreThanZero();
  error DecentralisedStableCoin__BurnAMountExceedsBalance();
  error DecentralisedStableCoin__NotZeroAddress();

    constructor() ERC20("DecentralisedStableCoin","DSC"){}
        
    function burn(uint256 _amount) public override onlyOwner {
      if (_amount <= 0) {
        revert DecentralisedStableCoin__MustBeMoreThanZero();
      }
      uint256 balance = balanceOf(msg.sender);
      if (balance < _amount) {
        revert DecentralisedStableCoin__BurnAMountExceedsBalance();
      }
      super.burn(_amount);
    }

    function mint(address _to, uint256 _amount) external onlyOwner returns(bool) {
      if (_to == address(0)) {
        revert DecentralisedStableCoin__NotZeroAddress();
      }
      if (_amount <= 0) {
        revert DecentralisedStableCoin__MustBeMoreThanZero();
      }
      _mint(_to, _amount);
      return true;
    }

}