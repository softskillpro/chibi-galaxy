const Chibis = artifacts.require("Chibis");
const {expect} = require('chai');
const utils = require("./helpers/utils");

contract("Chibis", (accounts) => {
	let contractInstance;
	beforeEach(async () => {
		contractInstance = await Chibis.new();
	});

	it("mint new items", async () => {
		const initialMintCount = parseInt(await contractInstance.currentMintCount());
		await contractInstance.mint(accounts[1]);
		const currentMintCount = parseInt(await contractInstance.currentMintCount());
		expect(currentMintCount).to.be.above(initialMintCount, "mint count did not increase");
	});

	it("non contract owner can not mint new items", async () => {
		await utils.shouldThrow(contractInstance.mint(accounts[1], {from: accounts[2]}));
	});

	it("contract owner should set base token uri", async () => {
		const baseURI = "https://chibis.io";
		await contractInstance.setBaseURI(baseURI, {from: accounts[0]});
		const currentBaseURI = await contractInstance.baseURI()
		expect(currentBaseURI).to.equal(baseURI, `baseURI is not ${baseURI}`);
	});

	it("non contract owner can not set base token uri", async () => {
		const baseURI = "https://chibis.io";
		await utils.shouldThrow(contractInstance.setBaseURI(baseURI, {from: accounts[1]}));
	});

	it("contract owner can set token uri", async () => {
		await contractInstance.mint(1);
		const tokenID = await contractInstance.currentMintCount({from: accounts[0]});
		const tokenURI = "https://chibis.io/collection/019";
		await contractInstance.setTokenURI(tokenID, tokenURI, {from: accounts[0]});
		const currentTokenURI = await contractInstance.tokenURI(tokenID);
		expect(currentTokenURI).to.equal(tokenURI, `tokenURI is not ${tokenURI}`);
	})

	it("non contract owner can not set token uri", async () => {
		await contractInstance.mint(1);
		const tokenID = await contractInstance.currentMintCount();
		const tokenURI = "https://chibis.io/collection/019";
		await utils.shouldThrow(contractInstance.setTokenURI(tokenID, tokenURI, {from: accounts[1]}));
	})
});