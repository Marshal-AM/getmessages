require('dotenv').config();
const express = require('express');
const { 
  Client,
  PrivateKey,
  AccountId,
  TopicId,
  TopicMessageQuery
} = require("@hashgraph/sdk");

const app = express();
const port = process.env.PORT || 3000;

// Configure Hedera client
const client = Client.forTestnet();
client.setOperator(
  AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
);

// Strict validation for complete character data
function isCompleteCharacter(content) {
  try {
    const obj = JSON.parse(content);
    return [
      'uuid', 'name', 'description', 'personality', 
      'scenario', 'first_mes', 'mes_example',
      'creator_notes', 'system_prompt'
    ].every(field => obj[field] !== undefined);
  } catch (e) {
    return false;
  }
}

app.get('/get-complete-characters', async (req, res) => {
  const topicId = TopicId.fromString("0.0.5882994");
  const completeCharacters = [];
  let subscription;

  console.log(`Collecting complete character data from topic ${topicId.toString()}`);

  try {
    const collectionPromise = new Promise((resolve) => {
      subscription = new TopicMessageQuery()
        .setTopicId(topicId)
        .setStartTime(0)
        .subscribe(
          client,
          (message) => {
            try {
              const messageContent = Buffer.from(message.contents).toString();
              
              if (isCompleteCharacter(messageContent)) {
                const character = JSON.parse(messageContent);
                completeCharacters.push({
                  ...character,
                  sequenceNumber: message.sequenceNumber.toString(),
                  timestamp: message.consensusTimestamp.toDate().toISOString()
                });
                console.log(`Valid character #${message.sequenceNumber}: ${character.name}`);
              }
            } catch (err) {
              console.error("Message processing error:", err);
            }
          },
          null,
          () => resolve()
        );
    });

    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.log('Collection timeout reached');
        resolve();
      }, 5000);
    });

    await Promise.race([collectionPromise, timeoutPromise]);

    if (subscription) subscription.unsubscribe();

    res.json({
      topicId: topicId.toString(),
      completeCharacterCount: completeCharacters.length,
      characters: completeCharacters
    });

  } catch (error) {
    console.error("Error:", error);
    if (subscription) subscription.unsubscribe();
    res.status(500).json({ 
      error: "Failed to retrieve character data",
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Complete character endpoint: http://localhost:${port}/get-complete-characters`);
});
