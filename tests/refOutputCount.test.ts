import client, { JsonRpc } from "../src/rpc";
import {
  GetUtxo,
  Utxo,
  utxoHelper,
  updateUtxos,
  swap,
  outpointHex,
  buildMeltTx,
} from "../src/util";
import {
  Script,
  Transaction,
  // @ts-ignore
} from "@radiantblockchain/radiantjs";

describe("refOutputCount", () => {
  let rpc: JsonRpc;
  let getUtxo: GetUtxo;
  let coins: Utxo[];
  let change: Utxo;
  let ref1: string;
  let ref2: string;

  beforeAll(async () => {
    rpc = await client();
    getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates utxos", async () => {
    const { privKey: privKey, ...input } = coins[0];
    const { address } = input;

    const splitTx = new Transaction()
      .from(input)
      .to(address, 1)
      .change(address)
      .sign(privKey)
      .seal();

    const { data: splitData } = await rpc("sendrawtransaction", [
      splitTx.toString(),
    ]);
    const { result: splitTxId } = splitData;
    expect(splitTxId.length).toBe(64);
    expect(splitData.error).toBeNull();

    coins = updateUtxos(coins[0], splitTxId, splitTx);
    change = coins.pop() as Utxo;

    ref1 = `${swap(coins[0].txId)}${outpointHex(coins[0].outputIndex)}`;
    ref2 = `${swap(change.txId)}${outpointHex(change.outputIndex)}`;
    const scripts = [
      Script.fromASM(`OP_PUSHINPUTREF ${ref1} OP_DROP OP_1`).toHex(),
      Script.fromASM(
        `OP_PUSHINPUTREF ${ref1} OP_DROP OP_PUSHINPUTREF ${ref1} OP_DROP OP_1`
      ).toHex(),
      Script.fromASM(
        `OP_PUSHINPUTREF ${ref1} OP_DROP OP_PUSHINPUTREF ${ref2} OP_DROP OP_1`
      ).toHex(),
      Script.fromASM(
        `${ref1} OP_REFOUTPUTCOUNT_UTXOS OP_3 OP_EQUALVERIFY ${ref2} OP_REFOUTPUTCOUNT_UTXOS OP_1 OP_EQUALVERIFY 000000000000000000000000000000000000000000000000000000000000000000000000 OP_REFOUTPUTCOUNT_UTXOS OP_0 OP_EQUAL`
      ).toHex(),
    ];

    // TODO test OP_REFOUTPUTCOUNT_OUTPUTS

    const tx = new Transaction().from(coins).from(change);
    scripts.forEach((script) =>
      tx.addOutput(
        new Transaction.Output({
          script,
          satoshis: 1,
        })
      )
    );
    tx.change(address).sign(privKey).seal();

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
    coins = updateUtxos(coins[0], txId, tx);
    change = coins.pop() as Utxo;
  });

  it("has correct count", async () => {
    const { privKey: privKey, address } = change;

    const tx = new Transaction()
      .from(coins[0])
      .from(coins[1])
      .from(coins[2])
      .from(coins[3])
      .from(change)
      .change(address)
      .sign(privKey)
      .seal();

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
  });

  /*
  it("melts", async () => {
    const { address, privKey } = coins1;

    const tx = buildMeltTx(
      [coins1, coins2],
      change,
      address,
      privKey
    );

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
  });
  */
});
