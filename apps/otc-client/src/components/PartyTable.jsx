import React from "react";
import { formatPublicKey, shortenText } from "../utils";

const PartyTable = ({ data, title, selectedParty, onSelectParty }) => {
  return (
    <div className="table-container">
      <h2>{title}</h2>
      <div className="table">
        <div className="table-header">
          <div>IP Address</div>
          <div>Public Key</div>
          <div>Address</div>
        </div>
        <div className="table-body">
          {data.map((party, index) => (
            <div
              key={index}
              className={`table-row ${
                selectedParty?.ipAddress === party.ipAddress ? "selected" : ""
              }`}
              onClick={() => onSelectParty(party)}
            >
              <div>{party.ipAddress}</div>
              <div>{shortenText(formatPublicKey(party.pubKey), 10, 8)}</div>
              <div>{shortenText(party.address, 10, 8)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PartyTable;
