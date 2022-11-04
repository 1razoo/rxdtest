import client, { JsonRpc } from "../src/rpc";
import {
  GetUtxo,
  Utxo,
  utxoHelper,
  updateUtxos,
  buildMeltTx,
} from "../src/util";
import {
  Script,
  Transaction,
  // @ts-ignore
} from "@radiantblockchain/radiantjs";

describe("stateSeparatorIndex", () => {
  describe.each([
    [
      "no separator",
      "1111 OP_DROP OP_1",
      "OP_0",
    ],
    [
      "separator at start",
      "OP_STATESEPERATOR 1111 OP_DROP OP_1",
      "OP_1",
    ],
    [
      "separator at middle",
      "OP_1 OP_DROP OP_STATESEPERATOR 1111 OP_DROP OP_1",
      "OP_3",
    ],
    [
      "separator at end",
      "1111 OP_DROP OP_1 OP_STATESEPERATOR",
      "OP_6",
    ],
  ])("%s", (_, asm, separatorIndex) => {
    let rpc: JsonRpc;
    let getUtxo: GetUtxo;
    let coins1: Utxo;
    let coins2: Utxo;
    let change: Utxo;
    const script1 = Script.fromASM(asm).toHex();
    const script2 = Script.fromASM(
      `OP_0 OP_STATESEPERATORINDEX_UTXO ${separatorIndex} OP_DUP OP_ROT OP_EQUALVERIFY OP_0 OP_STATESEPERATORINDEX_OUTPUT OP_EQUAL`
    ).toHex();

    beforeAll(async () => {
      rpc = await client();
      getUtxo = utxoHelper(rpc);
      coins1 = await getUtxo(100000000);
    });

    it("creates utxos", async () => {
      const { privKey: privKey, ...input } = coins1;
      const { address } = input;

      const tx = new Transaction()
        .from(coins1)
        .addOutput(
          new Transaction.Output({
            script: script1,
            satoshis: 1,
          })
        )
        .addOutput(
          new Transaction.Output({
            script: script2,
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

    it("gets correct input and output statescript", async () => {
      const { privKey: privKey, ...input } = coins1;
      const { address } = input;

      const tx = new Transaction()
        .from(coins1)
        .from(coins2)
        .from(change)
        .addOutput(
          new Transaction.Output({
            script: script1,
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
      [coins1, change] = updateUtxos(coins1, txId, tx);
    });

    it("melts", async () => {
      const { address, privKey } = coins1;

      const tx = buildMeltTx([[coins1, script1]], change, address, privKey);

      const { data } = await rpc("sendrawtransaction", [tx.toString()]);
      const { result: txId } = data;
      expect(txId.length).toBe(64);
      expect(data.error).toBeNull();
    });
  });
});
