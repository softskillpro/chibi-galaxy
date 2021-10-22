const Chibis = artifacts.require("Chibis");
const {expect} = require('chai');
const utils = require("./helpers/utils");

contract("Chibis", (accounts) => {
	let contractInstance;
	beforeEach(async () => {
		contractInstance = await Chibis.new();
	});

	it("mint new items", async () => {
		const result = await contractInstance.mint({from: accounts[0]});
		const newTokenId = parseInt(result.receipt.logs[0].args.tokenId);
		// console.log(JSON.stringify({newTokenId}, null, 4));
		expect(newTokenId).to.be.above(0, "mint count did not increase");
	});

	it("non contract owner can not mint new items", async () => {
		await utils.shouldThrow(contractInstance.mint({from: accounts[1]}));
	});

	it("contract owner should set base token uri", async () => {
		const baseURI = "https://chibis.io/collection/";
		await contractInstance.setBaseURI(baseURI, {from: accounts[0]});
		const currentBaseURI = await contractInstance.baseURI()
		expect(currentBaseURI).to.equal(baseURI, `baseURI is not ${baseURI}`);
	});

	it("non contract owner can not set base token uri", async () => {
		const baseURI = "https://chibis.io/collection/";
		await utils.shouldThrow(contractInstance.setBaseURI(baseURI, {from: accounts[1]}));
	});

	it("get token uri", async () => {
		const baseURI = "https://chibis.io/collection/";
		await contractInstance.setBaseURI(baseURI, {from: accounts[0]});
		const result = await contractInstance.mint({from: accounts[0]});
		const tokenId = parseInt(result.receipt.logs[0].args.tokenId);
		const testTokenURI = `${baseURI}${tokenId}`;
		const tokenURI = await contractInstance.tokenURI(tokenId);
		// console.log(`testTokenURI: ${testTokenURI}, tokenURI: ${tokenURI}`);
		expect(tokenURI).to.equal(testTokenURI, `tokenURI is not ${tokenURI}`);
	})
});