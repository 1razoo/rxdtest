import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import { Utxo, utxoHelper, updateUtxos, buildTx } from "../src/util";

describe("stateScriptBytecode", () => {
  describe.each([
    [
      "no separator",
      "1111 OP_DROP OP_1",
      "5df6e0e2761359d30a8275058e299fcc0381534545f55cf43e41983f5d4c9456",
    ],
    [
      "separator at start",
      "OP_STATESEPARATOR 1111 OP_DROP OP_1",
      "5df6e0e2761359d30a8275058e299fcc0381534545f55cf43e41983f5d4c9456",
    ],
    [
      "separator at middle",
      "OP_1 OP_DROP OP_STATESEPARATOR 1111 OP_DROP OP_1",
      "7ac3891f7a470b9e25b035db7b4e03218e80798b135ce98abc82127241104102",
    ],
    [
      "separator at end",
      "1111 OP_DROP OP_1 OP_STATESEPARATOR",
      "4c11796c796066e1d7e1181523ea77ef52c4def24b088cf668df10337153bbe4",
    ],
  ])("%s", (_, asm, hash) => {
    let rpc: JsonRpc;
    let coins: Utxo[];
    const script2 = `OP_0 OP_STATECRIPTBYTECODE_UTXO OP_HASH256 ${hash} OP_DUP OP_ROT OP_EQUALVERIFY OP_0 OP_STATECRIPTBYTECODE_OUTPUT OP_HASH256 OP_EQUAL`;

    beforeAll(async () => {
      rpc = await client();
      const getUtxo = utxoHelper(rpc);
      coins = [await getUtxo(100000000)];
    });

    it("creates utxos", async () => {
      const tx = buildTx(coins, [asm, script2]);
      const response = await rpc("sendrawtransaction", [tx.toString()]);
      expect(response).toBeValidTx();
      coins = updateUtxos(coins[0], response.data.result, tx);
    });

    it("gets correct input and output statescript", async () => {
      const tx = buildTx(coins, [asm]);
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
