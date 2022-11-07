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

describe("disallowPushInputRefSibling", () => {
  let rpc: JsonRpc;
  let coins: Utxo;
  let token: Utxo;
  let change: Utxo;
  let ref: string;

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = await getUtxo(100000000);
  });

  it("mints", async () => {
    ref = `${swap(coins.txId)}${outpointHex(coins.outputIndex)}`;

    const tx = buildTx(
      [coins],
      [
        `OP_PUSHINPUTREF ${ref} OP_DROP OP_DISALLOWPUSHINPUTREFSIBLING ${ref} OP_DROP OP_1`,
      ]
    );

    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    [token, change] = updateUtxos(coins, response.data.result, tx);
  });

  it("disallows sibling ref", async () => {
    const tx = buildTx(
      [token, change],
      [token.script, `OP_PUSHINPUTREF ${ref} OP_DROP OP_1`]
    );

    expect(await rpc("sendrawtransaction", [tx.toString()])).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });

  it("transfers", async () => {
    const tx = buildTx([token, change], [token.script]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    [token, change] = updateUtxos(token, response.data.result, tx);
  });

  it("melts", async () => {
    const tx = buildTx([token, change], []);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
  });
});
