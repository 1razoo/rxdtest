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

describe("refType", () => {
  let rpc: JsonRpc;
  let getUtxo: GetUtxo;
  let coins1: Utxo;
  let coins2: Utxo;
  let change: Utxo;
  let ref1: string;
  let ref2: string;

  beforeAll(async () => {
    rpc = await client();
    getUtxo = utxoHelper(rpc);
    coins1 = await getUtxo(100000000);
  });

  it("creates utxos", async () => {
    const { privKey: privKey, ...input } = coins1;
    const { address } = input;

    const splitTx = new Transaction()
      .from(input)
      .to(address, 1)
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

    [coins1, coins2, change] = updateUtxos(coins1, splitTxId, splitTx);

    ref1 = `${swap(coins1.txId)}${outpointHex(coins1.outputIndex)}`;
    ref2 = `${swap(coins2.txId)}${outpointHex(coins2.outputIndex)}`;

    const tx = new Transaction()
      .from(coins1)
      .from(coins2)
      .from(change)
      .addOutput(
        new Transaction.Output({
          script: Script.fromASM(
            `OP_PUSHINPUTREF ${ref1} OP_DUP OP_REFTYPE_UTXO OP_1 OP_EQUALVERIFY OP_REFTYPE_OUTPUT OP_1 OP_EQUAL`
          ).toHex(),
          satoshis: 1,
        })
      )
      .addOutput(
        new Transaction.Output({
          script: Script.fromASM(
            `OP_PUSHINPUTREFSINGLETON ${ref2} OP_DUP OP_REFTYPE_UTXO OP_2 OP_EQUALVERIFY OP_REFTYPE_OUTPUT OP_2 OP_EQUAL`
          ).toHex(),
          satoshis: 1,
        })
      )
      .change(address)
      .sign(privKey)
      .seal();

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
    [coins1, coins2, change] = updateUtxos(coins1, txId, tx);
  });

  it("has correct ref types", async () => {
    const { privKey: privKey, ...input } = coins1;
    const { address } = input;

    const tx = new Transaction()
      .from(coins1)
      .from(coins2)
      .from(change)
      .addOutput(
        new Transaction.Output({
          script: Script.fromASM(
            `OP_PUSHINPUTREF ${ref1} OP_DROP OP_1`
          ).toHex(),
          satoshis: 1,
        })
      )
      .addOutput(
        new Transaction.Output({
          script: Script.fromASM(
            `OP_PUSHINPUTREFSINGLETON ${ref2} OP_DROP OP_1`
          ).toHex(),
          satoshis: 1,
        })
      )
      .change(address)
      .sign(privKey)
      .seal();

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
    [coins1, coins2, change] = updateUtxos(coins1, txId, tx);
  });

  it("melts", async () => {
    const { address, privKey } = coins1;

    const tx = buildMeltTx([coins1, coins2], change, address, privKey);

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
  });
});
