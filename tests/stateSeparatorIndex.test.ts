import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import { Utxo, utxoHelper, updateUtxos, buildTx } from "../src/util";

describe("stateSeparatorIndex", () => {
  describe.each([
    ["no separator", "1111 OP_DROP OP_1", "OP_0"],
    ["separator at start", "OP_STATESEPARATOR 1111 OP_DROP OP_1", "OP_1"],
    [
      "separator at middle",
      "OP_1 OP_DROP OP_STATESEPARATOR 1111 OP_DROP OP_1",
      "OP_3",
    ],
    ["separator at end", "1111 OP_DROP OP_1 OP_STATESEPARATOR", "OP_6"],
  ])("%s", (_, asm, separatorIndex) => {
    let rpc: JsonRpc;
    let coins: Utxo[];
    const script1 = asm;
    const script2 = `OP_0 OP_STATESEPARATORINDEX_UTXO ${separatorIndex} OP_DUP OP_ROT OP_EQUALVERIFY OP_0 OP_STATESEPARATORINDEX_OUTPUT OP_EQUAL`;

    beforeAll(async () => {
      rpc = await client();
      const getUtxo = utxoHelper(rpc);
      coins = [await getUtxo(100000000)];
    });

    it("creates utxos", async () => {
      const tx = buildTx(coins, [script1, script2]);
      const response = await rpc("sendrawtransaction", [tx.toString()]);
      expect(response).toBeValidTx();
      coins = updateUtxos(coins[0], response.data.result, tx);
    });

    it("gets correct input and output statescript", async () => {
      const tx = buildTx(coins, [script1]);
      const response = await rpc("sendrawtransaction", [tx.toString()]);
      expect(response).toBeValidTx();
      coins = updateUtxos(coins[0], response.data.result, tx);
    });

    it("melts", async () => {
      const tx = buildTx(coins, []);
      const response = await rpc("sendrawtransaction", [tx.toString()]);
      expect(response).toBeValidTx();
      coins = updateUtxos(coins[0], response.data.result, tx);
    });
  });
});
