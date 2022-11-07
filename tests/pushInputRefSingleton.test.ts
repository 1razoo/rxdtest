import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import {
  Utxo,
  utxoHelper,
  updateUtxos,
  swap,
  outpointHex,
  buildTx,
} from "../src/util";

describe("pushInputRefSigleton", () => {
  let rpc: JsonRpc;
  let coins: Utxo;

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = await getUtxo(100000000);
  });

  it("disallows invalid tx id", async () => {
    const tx = buildTx(
      [coins],
      [
        "OP_PUSHINPUTREFSINGLETON 000000000000000000000000000000000000000000000000000000000000000000000000 OP_1",
      ]
    );

    expect(await rpc("sendrawtransaction", [tx.toString()])).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });

  it("disallows invalid outpoint", async () => {
    const tx = buildTx(
      [coins],
      [`OP_PUSHINPUTREFSINGLETON ${swap(coins.txId)}00000001 OP_1`]
    );

    expect(await rpc("sendrawtransaction", [tx.toString()])).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });

  describe("token", () => {
    let token: Utxo;
    let change: Utxo;
    let ref;

    it("mints", async () => {
      ref = `${swap(coins.txId)}${outpointHex(coins.outputIndex)}`;
      const tx = buildTx(
        [coins],
        [`OP_PUSHINPUTREFSINGLETON ${ref} OP_DROP OP_1`]
      );
      const response = await rpc("sendrawtransaction", [tx.toString()]);
      expect(response).toBeValidTx();
      [token,change]= updateUtxos(coins, response.data.result, tx);
    });

    it("disallows duplicate singleton", async () => {
      const tx = buildTx([token, change], [token.script, token.script]);
      expect(await rpc("sendrawtransaction", [tx.toString()])).toReturnError(
        "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
      );
    });

    it("transfers", async () => {
      const tx = buildTx([token, change], [token.script]);
      const response = await rpc("sendrawtransaction", [tx.toString()]);
      expect(response).toBeValidTx();
      [token,change]= updateUtxos(coins, response.data.result, tx);
    });

    it("melts", async () => {
      const tx = buildTx([token, change], []);
      expect(await rpc("sendrawtransaction", [tx.toString()])).toBeValidTx();
    });
  });
});
