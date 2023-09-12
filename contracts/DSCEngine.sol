// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./DecentralisedStableCoin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title DSCEngine
 * @author Pranav Lakkadi 
 * 
 * The system is designed to be as minimal as possible, and have the tokens maintain a 1 token == $1 peg at all times.
 * This is a stablecoin with the properties:
 * - Exogenously Collateralized
 * - Dollar Pegged
 * - Algorithmically Stable
 *
 * It is similar to DAI if DAI had no governance, no fees, and was backed by only WETH and WBTC.
 *
 * The DSC system should always be overcollateralised 
 * 
 * @notice This contract is the core of the Decentralized Stablecoin system. It handles all the logic
 * for minting and redeeming DSC, as well as depositing and withdrawing collateral.
 * @notice This contract is based on the MakerDAO DSS system
 */
contract DSCEngine is ReentrancyGuard {

    ///////////////////
    //   Errors  //////
    ///////////////////
    error DSCEngine__NeedsMoreThanZero();
    error DSCEngine__TokenNotAllowed(address token);
    error DSCEngine__TokenAddresslengthandPriceFeedAddresslengthMustBeEqual();
    error DSCEngine__TransferFailed();
    error DSCEngine__BreaksHealthFactor(uint256 healthFactor);
    error DSCEngine__MintFailed();
    error DSCEngine__TokenAddressZero();
    error DSCEngine__HealthFactorOk();
    error DSCEngine__HealthFactorNotImproved();
    error DSCEngine__InValidIndex();

    ///////////////////
    // Modifiers  /////
    ///////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert DSCEngine__NeedsMoreThanZero();
        }
        _;
    }

    modifier isAllowedToken(address token) {
        if (s_priceFeeds[token] == address(0)) {
            revert DSCEngine__TokenNotAllowed(token);
        }
        _;
    }

    //////////////////////
    // State Variables ///
    //////////////////////
    uint256 private constant ADDITIONAL_FEED_PRECISION = 1e10;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant LIQUIDATION_TRESHOLD = 50; // 200% overCollateralised
    uint256 private constant LIQUIDATION_PRECISION = 100;
    uint256 private constant MIN_HEALTH_FACTOR = 1e18;
    uint256 private constant LIQUIDATION_BONUS = 10; // 10% Bonus 


    mapping(address token => address pricefeed) private s_priceFeeds;
    mapping(address user => mapping(address token => uint256 amount)) private s_CollateralDeposited;
    mapping(address user => uint256 amountDSCMinted) private s_DSCMinted;
    address[] private s_CollateralTokens;

    DecentralisedStableCoin private immutable i_DSC; 

    ///////////////////
    //   Events   /////
    ///////////////////

    event CollateralDeposited(address indexed user, address indexed token, uint256 indexed amount);
    event CollateralRedeemed(address indexed RedeemedFrom, address indexed RedeemedTo, address indexed token, uint256 amount);

    ///////////////////
    // Functions  /////
    ///////////////////

    constructor (address[] memory tokenAddresses,address[] memory pricefeedAddresses,address DSCAddress) {
        if (tokenAddresses.length != pricefeedAddresses.length) {
            revert DSCEngine__TokenAddresslengthandPriceFeedAddresslengthMustBeEqual(); 
        }
        uint256 length = tokenAddresses.length;
        
        // The price feed address will be w.r.t USD 
        for (uint i = 0; i < length; ) {
            if (tokenAddresses[i] == address(0) || pricefeedAddresses[i] == address(0)) {
           revert DSCEngine__TokenAddressZero();
        }
            s_priceFeeds[tokenAddresses[i]] = pricefeedAddresses[i];
            s_CollateralTokens.push(tokenAddresses[i]);

            unchecked {
                ++i;
            }
        }

        if (DSCAddress == address(0)) {
           revert DSCEngine__TokenAddressZero();
        }
        
        i_DSC = DecentralisedStableCoin(DSCAddress);
    }

    ////////////////////////////
    //   External Functions   //
    ////////////////////////////
    
    /**
     * @param tokenCollateralAddress address of ERC20 token 
     * @param amountCollateral amount of token deposited as collateral
     * @param amountDSCtoMint amount of DSC minted 
     * @notice This function will deposit collateral and mint DSC in 1 function 
     */
    function depositCollateralAndMintDSC(address tokenCollateralAddress, uint256 amountCollateral,uint256 amountDSCtoMint) 
    external moreThanZero(amountCollateral) moreThanZero(amountDSCtoMint){
        if (tokenCollateralAddress == address(0)) {
           revert DSCEngine__TokenAddressZero();
        }
        depositCollateral(tokenCollateralAddress, amountCollateral);
        mintDSC(amountDSCtoMint);
    }

    /** 
     * @notice follows CEI 
     * @param tokenCollateralAddress - address of the token deposited as collateral
     * @param amountCollateral - amount of collateral as deposit 
     */
    function depositCollateral(address tokenCollateralAddress, uint256 amountCollateral) public 
    moreThanZero(amountCollateral) 
    isAllowedToken(tokenCollateralAddress) 
    nonReentrant
    {
        unchecked {
            s_CollateralDeposited[msg.sender][tokenCollateralAddress] += amountCollateral;
        }

        emit CollateralDeposited(msg.sender, tokenCollateralAddress , amountCollateral);

        bool success = IERC20(tokenCollateralAddress).transferFrom(msg.sender, address(this), amountCollateral);
        if (!success) {
            revert DSCEngine__TransferFailed();
        }
    }


    /**
     * 
     * @param tokenCollateralAddress address of the collateral token
     * @param amountCollateral amount of collateral to redeem
     * @param amountDSCtoBurn amount of DSC to burn 
     * @notice this function burns th DSC token to get back the deposited Collateral 
     */
    function redeemCollateralForDSC(address tokenCollateralAddress,uint256 amountCollateral, uint256 amountDSCtoBurn) 
    external {
        burnDSC(amountDSCtoBurn);
        redeemCollateral(tokenCollateralAddress, amountCollateral);
    }

    
    /**
     * This function is used to redeem collateral as long as user doesnt break the HealthFactor
     * 
     * @param tokenCollateralAddress The ERC20 Address of the token deposited as collateral
     * @param amountCollateral The amount of the collateral user wants to redeem 
     */
    function redeemCollateral(address tokenCollateralAddress, uint256 amountCollateral ) 
    public moreThanZero(amountCollateral) nonReentrant {
        // in order to Redeem collateral:
        // 1) Health factor must be more than 1, after the collateral has been pulled  
        if (tokenCollateralAddress == address(0)) {
            revert DSCEngine__TokenAddressZero();
        }
        _redeemCollateral(tokenCollateralAddress, amountCollateral, msg.sender, msg.sender);

        _RevertIfHealthFactorIsBroken(msg.sender);
    }

    /**
     * @notice follows CEI
     * @param amountDSCtoMint The amount of Decentralised stable coin to mint 
     * @notice They must always have more collateral value than Minimum threshold 
     */
    function mintDSC(uint256 amountDSCtoMint) moreThanZero(amountDSCtoMint) nonReentrant public {
        unchecked {
            s_DSCMinted[msg.sender] += amountDSCtoMint;
        }
        _RevertIfHealthFactorIsBroken(msg.sender);
        bool minted = i_DSC.mint(msg.sender,amountDSCtoMint);
        if (!minted) {
            revert DSCEngine__MintFailed();
        }
    }

    /**
     * This function is to burn the minted token 
     * @param amount The amount DSC to burn 
     */
    function burnDSC(uint256 amount) public moreThanZero(amount){
        _burnDSC(amount, msg.sender, msg.sender);
        
        // Not sure if the below statement is needed 
        // _RevertIfHealthFactorIsBroken(msg.sender); 
        // The above statement has been removed since it doenst allow the user to partially burn tokens
    }

    // if we do start nearing undercollateralization, we need someone to liquidate positions
    // If someone is almost undercollateralized we will pay u to liquidate them
    // eg if someone intial deposited $100 to get $50DSC
    // the deposit value falls to $75 we will ask them to liquidate it since it reached the threshold
    // the Liquidator takes of $75 and burns $50 DSC 
    /** 
     * @param collateral The ERC20 address of the collateral they want to pay off 
     * @param user The address of the user whose debt they want to pay, The health factor should
     *         below the MIN_HEALTH_FACTOR
     * @param debtToCover The amount they are willing to cover so that they improve the user's healtfactor 
     * @notice you can partially cover the users debt and will get a liquidation bonus 
     * @notice The function working assumes the protocol will be roughly 200% overcollateralised 
     *         in order fro this to work 
     * @notice A known bug would be if the protocol was only 100% collateralized, we wouldn't be able to liquidate anyone.
     * For example, if the price of the collateral plummeted before anyone could be liquidated
     * 
     * Follows CEI 
     */
    function liquidate(address collateral, address user, uint256 debtToCover) 
    external moreThanZero(debtToCover) nonReentrant {
        // needs to check the health Factor
        if (collateral == address(0) || user == address(0)) {
            revert DSCEngine__TokenAddressZero();
        }

        uint256 startingHealthFactor = _HealthFactor(user);
        if (startingHealthFactor >= MIN_HEALTH_FACTOR ) {
            revert DSCEngine__HealthFactorOk();
        }
        uint256 tokenAmountFromDebtcovered = getTokenAmountinUSD(collateral, debtToCover);

        uint256 bonusCollateral = (tokenAmountFromDebtcovered/ LIQUIDATION_BONUS)/LIQUIDATION_PRECISION ;
        
        uint256 totalCollateralToRedeem = tokenAmountFromDebtcovered + bonusCollateral;

        _redeemCollateral(collateral, totalCollateralToRedeem, user, msg.sender);

        _burnDSC(debtToCover, user, msg.sender);

        uint256 endingHealthFactor = _HealthFactor(user);
        if (endingHealthFactor <= startingHealthFactor) {
            revert DSCEngine__HealthFactorNotImproved();
        }
        _RevertIfHealthFactorIsBroken(msg.sender);
    }

    ////////////////////////////////////////////////
    //   Private and Internal View Functions   /////
    ////////////////////////////////////////////////

    /**
     * 
     * @dev this is a low level function dont call this untill you check the health Factor 
     */
    function _burnDSC(
        uint256 amountDSCToBurn,
        address onBehalfOf,
        address DSCFrom
    ) private {
        s_DSCMinted[onBehalfOf] -= amountDSCToBurn;
        bool success = i_DSC.transferFrom(DSCFrom ,address(this), amountDSCToBurn);
        if (!success) {
            revert DSCEngine__TransferFailed();
        }
        i_DSC.burn(amountDSCToBurn);
    }

    /**
     * @dev this is a low level function dont call this untill you check the health Factor 
     */
    function _redeemCollateral(
        address tokenCollateralAddress, 
        uint256 amountCollateral,
        address from, // The guy whose has taken the debt 
        address to) private {
        s_CollateralDeposited[from][tokenCollateralAddress] -= amountCollateral;

        emit CollateralRedeemed(from, to ,tokenCollateralAddress, amountCollateral);

        bool success = IERC20(tokenCollateralAddress).transfer(to, amountCollateral);
        if (!success) {
            revert DSCEngine__TransferFailed();
        }
    }

    /**
     * 
     * @param user The address of the user, to get the account Information 
     * @return totalDScMinted Returns the total DSC minted by the user
     * @return CollateralValueInUSD Returns the amount collateral deposited in USD
     */
    function _getAccountInformation(address user) 
    private 
    view 
    returns(uint256 totalDScMinted, uint256 CollateralValueInUSD) {
        totalDScMinted = s_DSCMinted[user];
        CollateralValueInUSD = _getAccountCollateralValue(user);
    }
    
    /**
     * Returns how close to liquidation a user is 
     * If the user goes below 1 the user can get liquidated 
     * @param user the address whose health factor we want to calculate
     */
    function _HealthFactor(address user) private view returns (uint256) {
        // total DSC minted 
        // total collateral value
        (uint256 totalDSCMinted, uint256 collateralValueinUSD) = _getAccountInformation(user);
        uint256 collateralAdjustedThreshold = (collateralValueinUSD/totalDSCMinted)/LIQUIDATION_PRECISION;
        return ((collateralAdjustedThreshold * PRECISION) / totalDSCMinted);
    }

    /**
     * This function is to check if an address when redeemed collateral breaks the healthFactor or not
     * 
     * @param user The address whose health factor is being checked 
     */
    function _RevertIfHealthFactorIsBroken(address user) internal view{
        // Check the health factor (To see if enough collateral is there or no)
        // Revert is enough collateral is not there
        uint256 userHealthFactor = _HealthFactor(user);
        if (userHealthFactor < MIN_HEALTH_FACTOR) {
            revert DSCEngine__BreaksHealthFactor(userHealthFactor);
        }

    }

    ////////////////////////////////////////////////
    //   Public and External View Functions   /////
    ////////////////////////////////////////////////

    /**
     * This is to convert the amount of DSC to the value in the collateral token terms in USD
     * 
     * @param token The address of the ERC20 to deposited as collateral
     * @param USDAmountInWei The Amount of DSC tokens 
     */
    function getTokenAmountinUSD(address token, uint256 USDAmountInWei) public view returns(uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(s_priceFeeds[token]);
        (,int256 price,,,) = priceFeed.latestRoundData();
        return ((USDAmountInWei * PRECISION) / (uint256(price) * ADDITIONAL_FEED_PRECISION));
    }

    /**
     * This function gives the value of the collateral deposited in USD 
     * 
     * @param user The address of the user who deposited the collateral
     */
    function _getAccountCollateralValue(address user) public view returns (uint256 totalCollateralValueUSD){
        // loop through each collateral token, get the amount they have deposited and map it 
        // to the price to get the USD value 
        uint256 length = s_CollateralTokens.length;
        for (uint i = 0; i < length; ) {
            address token = s_CollateralTokens[i];
            uint256 amount = s_CollateralDeposited[user][token];
            unchecked {
                totalCollateralValueUSD += getUSDValue(token, amount);
                ++i;
            }
        }
    }

    /**
     * This Function is to convert the depoisited token value into USD 
     * 
     * @param token The address of the ERC20 token deposited as collateral
     * @param amount The Quantity of the token deposited as collateral
     */
    function getUSDValue(address token, uint256 amount) public view returns(uint256) {
        AggregatorV3Interface pricefeed = AggregatorV3Interface(s_priceFeeds[token]);
        (,int price,,,) = pricefeed.latestRoundData();
        // since any uint256 has 18 decimals but the pricefeed returned has 8 decimals 
        // converting the returned feed value to 18 decimals 
        return ((uint256(price) * ADDITIONAL_FEED_PRECISION) * amount)/ PRECISION;
    } 

    function  getAdditionFeedPrecision() public pure returns (uint256) {
        return ADDITIONAL_FEED_PRECISION;
    }

    function getPrecision() public pure returns (uint256) {
        return PRECISION;
    }

    function getLiquidationThreshold() public pure returns (uint256) {
        return LIQUIDATION_TRESHOLD;
    }

    function getLiquidationPrecision() public pure returns (uint256) {
        return LIQUIDATION_PRECISION;
    }

    function getLiquidationBonus() public pure returns (uint256) {
        return LIQUIDATION_BONUS;
    }

    function getMinHealthFactor() public pure returns (uint256) {
        return MIN_HEALTH_FACTOR;
    }

    function getPriceFeedAddress(address token) public view returns(address) {
        if (token == address(0)) {
            revert DSCEngine__TokenAddressZero();
        }
        return s_priceFeeds[token];
    }

    function getCollateralDepositedAmount(address user, address token) public view returns(uint256) {
        if (user == address(0) || token == address(0)) {
            revert DSCEngine__TokenAddressZero();
        }
        return s_CollateralDeposited[user][token];
    }

    function getDSCMint(address user) public view returns (uint256) {
        if (user == address(0)) {
            revert DSCEngine__TokenAddressZero();
        }
        return s_DSCMinted[user];
    }

    function getCollateralTokens(uint256 index) public view returns (address) {
        if(s_CollateralTokens.length < index) {
            revert DSCEngine__InValidIndex();
        }
        return s_CollateralTokens[index];
    }

    function getDSCContractAddress() public view returns (DecentralisedStableCoin) {
        return i_DSC;
    }

    function getHealthFactor(address user) public view returns (uint256) {
        return _HealthFactor(user);
    }
}