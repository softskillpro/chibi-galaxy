const Chibis = artifacts.require("Chibis");
const ChibiApes = artifacts.require("ChibiApes");
const ChibiGalaxies = artifacts.require("ChibiGalaxies");

const {expect} = require('chai');
const web3 = require('web3');
const utils = require("./helpers/utils");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');


contract("ChibiGalaxies", (accounts) => {

	let owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7;
	let chibisContractInstance;
	let chibiApesContractInstance;
	let chibiGalaxiesContractInstance;
	let whitelistMerkleTree;

	const testPreMintPrice = 0.06;
	const testPublicMintPrice = 0.08;

	const setupContractAddresses = async () => {
		await chibiGalaxiesContractInstance.setGeneration1ContractAddress(chibisContractInstance.address);
		await chibiGalaxiesContractInstance.setGeneration2ContractAddress(chibiApesContractInstance.address);
	}
	const mintGen1 = async ({addr = addr1} = {}) => {
		// console.log(`mintGen1 called for ${addr}`)
		await chibisContractInstance.mint(addr);
	}
	const mintGen2 = async ({addr = addr1} = {}) => {
		// console.log(`mintGen2 called for ${addr}`)
		const chibiApesMintPrice = await chibiApesContractInstance.mintPrice();
		await chibiApesContractInstance.publicMint({from: addr, value: chibiApesMintPrice});
	}
	const setupPreMintForToday = async () => {
		await chibiGalaxiesContractInstance.unpause();
	}
	const setupPublicMintForToday = async () => {
		await chibiGalaxiesContractInstance.unpause();
	}
	const setUpWhitelist = async () => {
		const list = [owner, addr1, addr2, addr3, addr4, addr5, addr6];
		whitelistMerkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
		await chibiGalaxiesContractInstance.setWhitelistMerkleRoot(whitelistMerkleTree.getHexRoot());
	}
	beforeEach(async () => {
		// console.log(accounts);
		[owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7] = accounts.slice(0, 8);
		chibisContractInstance = await Chibis.new();
		chibiApesContractInstance = await ChibiApes.new();
		chibiApesContractInstance.setPublicMintPaused(false);
		chibiGalaxiesContractInstance = await ChibiGalaxies.new();
	});
	xit("print addresses", async () => {
		console.log(JSON.stringify({chibisContractAddress: chibisContractInstance.address, chibiApesContractAddress: chibiGalaxiesContractInstance.address}, null, 4));
	})
	xit("print estimates", async () => {
		const amountOfGas = await ChibiGalaxies.new.estimateGas();
		console.log(`Estimated cost to deploy ChibiGalaxies: ${web3.utils.fromWei(`${amountOfGas}`, 'ether')} eth`);
	});
	describe("setup", async () => {
		it("should update pre mint info.", async () => {

			const testPreMintPrice = "0.07";
			const testPreMintPriceInEther = web3.utils.toWei(testPreMintPrice, "ether");

			const testPublicMintPrice = "0.09";
			const testPublicMintPriceInEther = web3.utils.toWei(testPublicMintPrice, "ether");

			// console.log(JSON.stringify({testPreMintPrice, testPreMintStartTime: new Date(testPreMintStartTimeInSeconds.toNumber()*1000), testPublicMintPrice, testPublicMintStartTime: new Date(testPublicMintStartTimeInSeconds.toNumber()*1000)}, null, 4));

			await chibiGalaxiesContractInstance.setMintInfo(testPreMintPriceInEther, testPublicMintPriceInEther);

			const preMintPrice = web3.utils.fromWei(await chibiGalaxiesContractInstance.preMintPrice(), "ether");
			const publicMintPrice = web3.utils.fromWei(await chibiGalaxiesContractInstance.publicMintPrice(), "ether");

			// console.log(JSON.stringify({preMintPrice, preMintStartTime: new Date(preMintStartTime.toNumber()*1000), publicMintPrice, publicMintStartTime: new Date(publicMintStartTime.toNumber()*1000)}, null, 4));

			expect(preMintPrice).to.be.equal(testPreMintPrice, `pre mint price did not update to ${testPreMintPrice}`);
			expect(publicMintPrice).to.be.equal(testPublicMintPrice, `public mint price did not update to ${testPublicMintPrice}`);
		});
		it("should update max items.", async () => {
			const testMaxItems = web3.utils.toBN('6000');
			await chibiGalaxiesContractInstance.setCollectionSize(testMaxItems);
			const maxItems = await chibiGalaxiesContractInstance.collectionSize();
			// console.log(JSON.stringify({testMaxItems: testMaxItems.toString(), maxItems: maxItems.toString()}, null, 4));
			expect(maxItems.toString()).to.be.equal(testMaxItems.toString(), `max items did not update to ${testMaxItems}`);
		});
		it("token uri", async () => {
			await setupContractAddresses();

			const baseURI = "https://chibis.io/collection/";
			await chibiGalaxiesContractInstance.setBaseTokenURI(baseURI);

			const tokenId = 101;
			const testTokenURI = `${baseURI}${tokenId}`;
			const tokenURI = await chibiGalaxiesContractInstance.tokenURI(tokenId);
			// console.log({testTokenURI, tokenURI}, null, 4);
			expect(tokenURI).to.equal(testTokenURI, `tokenURI is not ${tokenURI}`);
		});
	})
	it ("should giveaway of 3 tokens.", async () => {
		const { logs } = await chibiGalaxiesContractInstance.giveawayMint(addr1, 3);
		const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
		// console.log(tokenIdsMinted);
		expect(tokenIdsMinted).with.length(3, `did not give away 3 tokens`);
		const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
		expect(addr1).to.equal(owner, "first token not owned by test account");
		expect(Math.max(...tokenIdsMinted)).to.be.below(101, "max giveaway token not below 101");
	});
	describe("whitelist", async () => {
		it("address should be in whitelist", async () => {
			await setUpWhitelist();
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr2));
			const isAccountWhitelisted = await chibiGalaxiesContractInstance.isAddressWhitelisted(proof, addr2);
			// console.log(`isAccountWhitelisted: ${isAccountWhitelisted}`);
			expect(isAccountWhitelisted, "account was NOT whitelisted").to.be.true;
		});
		it("address should NOT be in whitelist", async () => {
			await setUpWhitelist();
			// console.log(`address: ${addr7}`);
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr7));
			const isAccountWhitelisted = await chibiGalaxiesContractInstance.isAddressWhitelisted(proof, addr7);
			// console.log(`isAccountWhitelisted: ${isAccountWhitelisted}`);
			expect(isAccountWhitelisted, "account was whitelisted").to.be.false;
		});
	});
	describe("mint rare", async () => {
		const runMintRareTest = async ({doSetup = true, addr = addr1} = {}) => {
			// console.log(`runMintRareTest called for ${addr}`);
			if (doSetup){
				await setupPreMintForToday();
			}
			const { logs } = await chibiGalaxiesContractInstance.rareMint({from: addr, value: web3.utils.toWei(`0.0`, "ether")});
			const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
			expect(addr).to.equal(owner, "first token not owned by test account");
			return tokenIdsMinted;
		}
		it("should not mint when contract paused.", async () => {
			await utils.shouldThrow(chibiGalaxiesContractInstance.rareMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 1 rare tokens for gen 1 + gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen2();
			const tokens = await runMintRareTest();
			expect(tokens).with.length(1, "did not mint 1 token");
			const rareTokenIds = tokens.filter(tokenId => tokenId >= 101 && tokenId <= 250);
			expect(rareTokenIds).with.length(1, `did not mint 1 rare tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.rareMint({from: addr1, value: web3.utils.toWei(`0.0`, "ether")}));
		});
		it("should mint 2 rare tokens for gen 1 (2) + gen 2 (3) holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen1();
			await mintGen2();
			await mintGen2();
			await mintGen2();
			const tokens = await runMintRareTest();
			expect(tokens).with.length(2, "did not mint 2 token");
			const rareTokenIds = tokens.filter(tokenId => tokenId >= 101 && tokenId <= 250);
			expect(rareTokenIds).with.length(2, `did not mint 2 rare tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.rareMint({from: addr1, value: web3.utils.toWei(`0.0`, "ether")}));
		});
		it("should mint 1 rare token for each of 3 addresses.", async () => {
			await setupPreMintForToday();
			await setupContractAddresses();
			const test = async ({index, addr} = {}) => {
				return new Promise(async (resolve, reject) => {
					try {
						if (!addr){
							reject(new Error("address not specified"));
							return;
						}
						await mintGen1({addr});
						await mintGen2({addr});
						const tokens = await runMintRareTest({doSetup: false, addr});
						resolve(tokens);
					} catch (error){
						console.error(error);
						reject(error);
					}
				})
			}
			const addrs = [addr1, addr2, addr3];
			const promises = addrs.map((addr, index) => test({index, addr}));
			const results = await Promise.all(promises);
			// console.log(JSON.stringify({results}, null, 4));
			const success = results.filter(result => result.length === 1 && result[0] >= 101 && result[0] <= 250).length === 3;
			expect(success, "error minting 3 rare tokens").to.be.true
		});
		it("should not mint rare token for non gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await utils.shouldThrow(runMintRareTest());
		});
		it("should not mint rare token for non gen 1 holde.", async () => {
			await setupContractAddresses();
			await mintGen2();
			await utils.shouldThrow(runMintRareTest());
		});
	});
	describe("pre mint", async () => {
		const runPreMintTest = async ({addr = addr1} = {}) => {
			await setupPreMintForToday();
			const numChibisOwned = parseInt(await chibiGalaxiesContractInstance.numGeneration1sOwned({from: addr}));
			// console.log(`numChibisOwned: ${numChibisOwned}`);
			const numChibiApesOwned = parseInt(await chibiGalaxiesContractInstance.numGeneration2sOwned({from: addr}));
			// console.log(`numChibiApesOwned: ${numChibiApesOwned}`);
			const numToMint = (numChibisOwned * 3) + numChibiApesOwned;
			// console.log(`numToMint: ${numToMint}`);
			expect(numToMint).to.be.above(0, "number of tokens to min is 0");
			const testValueInEther = web3.utils.toWei(`${(testPreMintPrice*numToMint)}`, "ether");
			const { logs } = await chibiGalaxiesContractInstance.preMint({from: addr, value: testValueInEther});
			// console.log(JSON.stringify({result}, null, 4));
			const tokenIdsMintedDuringPre = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokenIdsMintedDuringPre: ${tokenIdsMintedDuringPre}`);
			expect(tokenIdsMintedDuringPre).with.length(numToMint, `did not mint ${numToMint}`);
			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMintedDuringPre[0]);
			expect(addr).to.equal(owner, "first token not owned by test account");
			return tokenIdsMintedDuringPre;
		}
		it("should not mint when contract paused.", async () => {
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 4 regular tokens for gen 1 + gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen2();
			const tokens = await runPreMintTest();
			expect(tokens).with.length(4, "did not mint 4 tokens");
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(4, `did not mint 4 reg tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 10 regular tokens for wallet with 2 gen 1 + 4 gen 2.", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen1();
			await mintGen2();
			await mintGen2();
			await mintGen2();
			await mintGen2();
			const tokens = await runPreMintTest();
			expect(tokens).with.length(10, "did not mint 10 tokens");
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(10, `did not mint 10 reg tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 3 regular tokens for gen 1 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			const tokens = await runPreMintTest();
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(3, `did not mint 3 regular tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr1, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
		it("should mint 1 regular token for gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen2({addr: addr7});
			const tokens = await runPreMintTest({addr: addr7});
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(1, `did not mint 3 regular tokens`);
			await utils.shouldThrow(chibiGalaxiesContractInstance.preMint({from: addr7, value: web3.utils.toWei(`${testPreMintPrice}`, "ether")}));
		});
	})
	describe("public mint", async () => {
		const runPublicMintTest = async ({addr = addr1} = {}) => {
			await setupPublicMintForToday();
			await setUpWhitelist();

			const numChibisOwned = parseInt(await chibiGalaxiesContractInstance.numGeneration1sOwned({from: addr}));
			// console.log(`numChibisOwned: ${numChibisOwned}`);

			const numChibiApesOwned = parseInt(await chibiGalaxiesContractInstance.numGeneration2sOwned({from: addr}));
			// console.log(`numChibiApesOwned: ${numChibiApesOwned}`);

			const maxItemsPerTx = parseInt(await chibiGalaxiesContractInstance.maxItemsPerTx());
			// console.log(`maxItemsPerTx: ${maxItemsPerTx}`);

			let numToMint = (numChibisOwned * 3) + numChibiApesOwned;

			if (numToMint === 0){
				numToMint = 1;
			}

			// console.log(`numToMint: ${numToMint}`);
			let testValueInEther = web3.utils.toWei(`${(testPublicMintPrice*numToMint)}`, "ether");
			// console.log(`eth: ${(testPublicMintPrice*numToMint)}`);

			if (maxItemsPerTx < numToMint){
				// should not allow minting above max number per transaction
				await utils.shouldThrow(chibiGalaxiesContractInstance.publicMint({from: addr1, value: testValueInEther}));
				numToMint = maxItemsPerTx;
				testValueInEther = web3.utils.toWei(`${(testPublicMintPrice*maxItemsPerTx)}`, "ether");
				// console.log(`eth: ${(testPublicMintPrice*maxItemsPerTx)}`);
			}

			const proof = whitelistMerkleTree.getHexProof(keccak256(addr));
			const { logs} = await chibiGalaxiesContractInstance.publicMint(proof, {from: addr, value: testValueInEther})
			// console.log(JSON.stringify({logs}, null, 4));

			// const amountOfGas = await chibiGalaxiesContractInstance.publicMint.estimateGas(proof, {from: addr, value: testValueInEther});
			// console.log(`estimated cost to mint: ${web3.utils.fromWei(`${amountOfGas}`, 'ether')} eth`)

			const tokenIdsMinted = logs.map(log => log.event === 'Mint' ? parseInt(log.args.tokenId) : undefined).filter(item => item !== undefined);
			// console.log(`tokenIdsMinted: ${tokenIdsMinted}`);
			expect(tokenIdsMinted.length === numToMint, `did not mint ${numToMint}`);

			const owner = await chibiGalaxiesContractInstance.ownerOf(tokenIdsMinted[0]);
			expect(addr1 === owner, "first token not owned by test account");

			return tokenIdsMinted;
		}
		it("should not mint when contract paused", async () => {
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr1));
			await utils.shouldThrow(chibiGalaxiesContractInstance.publicMint(proof, {from: addr1, value: web3.utils.toWei(`${testPublicMintPrice}`, "ether")}));
		});
		it("should not allow un-whitelisted user", async () => {
			await setupContractAddresses();
			const proof = whitelistMerkleTree.getHexProof(keccak256(addr7));
			await utils.shouldThrow(chibiGalaxiesContractInstance.publicMint(proof, {from: addr7, value: web3.utils.toWei(`${(testPublicMintPrice)}`, "ether")}));
		});
		it("should allow whitelisted user", async () => {
			await setupContractAddresses();
			const tokens = await runPublicMintTest();
			// console.log(JSON.stringify(tokens, null, 4));
			expect(tokens).with.length(1, "did not mint 1 tokens");
		});
		it("should allow all users", async () => {
			await setupContractAddresses();
			await chibiGalaxiesContractInstance.setOnlyWhitelistedCanMint(false);
			const tokens = await runPublicMintTest({addr: addr7});
			// console.log(JSON.stringify({tokens, length: tokens.length}, null, 4));
			expect(tokens).with.length(1, "did not mint 1 tokens");
		});
		it("should mint 4 regular tokens for gen 1 + gen 2 holder", async () => {
			await setupContractAddresses();
			await mintGen1();
			await mintGen2();
			const tokens = await runPublicMintTest();
			expect(tokens).with.length(4, "did not mint 4 tokens")
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(4, `did not mint 4 regular tokens`);
		});
		it("should mint 3 regular tokens for gen 1 holder.", async () => {
			await setupContractAddresses();
			await mintGen1();
			const tokens = await runPublicMintTest();
			expect(tokens).with.length(3, "did not mint 3 tokens")
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(3, `did not mint 3 regular tokens`);
		});
		it("should mint 1 regular token for gen 2 holder.", async () => {
			await setupContractAddresses();
			await mintGen2();
			const tokens = await runPublicMintTest();
			expect(tokens).with.length(1, "did not mint 1 tokens")
			const regularTokenIds = tokens.filter(tokenId => tokenId >= 251);
			expect(regularTokenIds).with.length(1, `did not mint 1 regular tokens`);
		});
	});
});