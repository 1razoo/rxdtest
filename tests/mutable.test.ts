import {
  Script,
  Opcode,
  // @ts-ignore
} from "@radiantblockchain/radiantjs";
import { sha256 } from "@noble/hashes/sha256";
import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import {
  Utxo,
  utxoHelper,
  updateUtxos,
  buildTx,
  swap,
  outpointHex,
  buildSplitTx,
} from "../src/util";

const mut = (nftRef: string, mutableRef: string, hash: Buffer) => {
  return [
    `${hash.toString("hex")} OP_DROP`, // State
    `OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${mutableRef}`, // Contract ref
    `OP_OVER OP_REFDATASUMMARY_OUTPUT OP_3 OP_ROLL 24 OP_MUL OP_SPLIT OP_NIP 24 OP_SPLIT OP_DROP ${nftRef} OP_EQUALVERIFY`, // NFT ref check
    `OP_SWAP OP_STATESCRIPTBYTECODE_OUTPUT OP_ROT OP_SPLIT OP_NIP 45 OP_SPLIT OP_DROP OP_OVER 20 OP_CAT OP_INPUTINDEX OP_INPUTBYTECODE OP_HASH256 OP_CAT OP_EQUALVERIFY`, // Contract ref + hash check
    `OP_3 OP_PICK 6d6f64 OP_EQUAL OP_IF OP_OVER OP_CODESCRIPTBYTECODE_OUTPUT OP_INPUTINDEX OP_CODESCRIPTBYTECODE_UTXO OP_EQUALVERIFY`, // mod
    `OP_OVER OP_STATESCRIPTBYTECODE_OUTPUT 20 OP_4 OP_PICK OP_HASH256 OP_CAT 75 OP_CAT OP_EQUALVERIFY`,
    `OP_ELSE OP_3 OP_PICK 736c OP_EQUALVERIFY OP_OVER OP_OUTPUTBYTECODE d8 OP_2 OP_PICK OP_CAT 6a OP_CAT OP_EQUAL OP_OVER OP_REFTYPE_OUTPUT OP_0 OP_NUMEQUAL OP_BOOLOR OP_VERIFY OP_ENDIF`, // seal
    `OP_4 OP_ROLL 61746f6d OP_EQUALVERIFY OP_2DROP OP_2DROP OP_1`, // atom
  ].join(" ");
};

const sig = (operation: string, payload: Buffer | Opcode) => {
  return new Script()
    .add(Buffer.from("atom"))
    .add(Buffer.from(operation))
    .add(payload) // Payload
    .add(Opcode.OP_1) // Contract output index
    .add(Opcode.OP_1) // Ref+hash index in token output
    .add(Opcode.OP_0) // Ref index in token output data summary
    .add(Opcode.OP_0); // Token output index
};

describe("mutable", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  let nftRef = "";
  let mutableRef = "";

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });
  it("creates mutable token", async () => {
    const splitTx = buildSplitTx(coins[0], 4);
    const splitResponse = await rpc("sendrawtransaction", [splitTx.toString()]);
    expect(splitResponse).toBeValidTx();
    coins = updateUtxos(coins[0], splitResponse.data.result, splitTx);

    nftRef = `${swap(coins[0].txId)}${outpointHex(coins[0].outputIndex)}`;
    mutableRef = `${swap(coins[1].txId)}${outpointHex(coins[1].outputIndex)}`;
    const mutScript = mut(
      nftRef,
      mutableRef,
      Buffer.from(
        "0000000000000000000000000000000000000000000000000000000000000000",
        "hex"
      )
    );
    const tokenScript = `OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`;

    const tx = buildTx(coins, [
      [tokenScript, 1],
      [mutScript, 1],
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("disallows update when token isn't present", async () => {
    const payload = Buffer.from("test");
    const payloadHash = Buffer.from(sha256(sha256(payload)));
    const scriptSig = sig("mod", payload);
    const mutScript = mut(nftRef, mutableRef, payloadHash);
    const tx = buildTx([coins[1], coins[2]], [[mutScript, 1]], [scriptSig]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toReturnError(
      "mandatory-script-verify-flag-failed (Script failed an OP_EQUALVERIFY operation) (code 16)"
    );
  });

  it("disallows update when hash is incorrect", async () => {
    const payload = Buffer.from("test");
    const payloadHash = Buffer.from(sha256(payload));
    const scriptSig = sig("mod", payload);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(`OP_REQUIREINPUTREF ${mutableRef}`))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const mutScript = mut(nftRef, mutableRef, payloadHash);
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
        [mutScript, 1],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toReturnError(
      "mandatory-script-verify-flag-failed (Script failed an OP_EQUALVERIFY operation) (code 16)"
    );
  });

  it("disallows update when contract not required", async () => {
    const payload = Buffer.from("test");
    const payloadHash = Buffer.from(sha256(payload));
    const scriptSig = sig("mod", payload);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(mutableRef))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const mutScript = mut(nftRef, mutableRef, payloadHash);
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
        [mutScript, 1],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toReturnError(
      "mandatory-script-verify-flag-failed (Script failed an OP_EQUALVERIFY operation) (code 16)"
    );
  });

  it("mutates", async () => {
    const payload = Buffer.from("test");
    const payloadHash = Buffer.from(sha256(sha256(payload)));
    const scriptSig = sig("mod", payload);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(`OP_REQUIREINPUTREF ${mutableRef}`))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const mutScript = mut(nftRef, mutableRef, payloadHash);
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
        [mutScript, 1],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("mutates again", async () => {
    const payload = Buffer.from("test 2");
    const payloadHash = Buffer.from(sha256(sha256(payload)));
    const scriptSig = sig("mod", payload);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(`OP_REQUIREINPUTREF ${mutableRef}`))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const mutScript = mut(nftRef, mutableRef, payloadHash);
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
        [mutScript, 1],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("disallows seal with mutate output", async () => {
    const payload = Buffer.from("test 2");
    const payloadHash = Buffer.from(sha256(sha256(payload)));
    const scriptSig = sig("sl", payload);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(`OP_REQUIREINPUTREF ${mutableRef}`))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const mutScript = mut(nftRef, mutableRef, payloadHash);
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
        [mutScript, 1],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toReturnError(
      "mandatory-script-verify-flag-failed (Script failed an OP_VERIFY operation) (code 16)"
    );
  });

  it("seals", async () => {
    const scriptSig = sig("sl", Opcode.OP_0);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(`OP_REQUIREINPUTREF ${mutableRef}`))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const mutScript = Script.fromASM(`OP_PUSHINPUTREFSINGLETON ${mutableRef} OP_RETURN`);
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
        [mutScript, 1],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it.skip("seals by omitting ref", async () => {
    const scriptSig = sig("sl", Opcode.OP_0);
    const scriptSigHash = Buffer.from(sha256(sha256(scriptSig.toBuffer())));
    const tokenStateScript = new Script()
      .add(Script.fromASM(`OP_REQUIREINPUTREF ${mutableRef}`))
      .add(scriptSigHash)
      .add(Opcode.OP_2DROP)
      .toASM();
    const tx = buildTx(
      coins,
      [
        [
          `${tokenStateScript} OP_STATESEPARATOR OP_PUSHINPUTREFSINGLETON ${nftRef} OP_DROP OP_TRUE`,
          1,
        ],
      ],
      [undefined, scriptSig]
    );
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });
});
