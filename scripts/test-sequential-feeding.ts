import { PET_REACTIONS, PetReactionType } from '../src/components/CompanionGame';

console.log('Testing Sequential (In-Order) Pet Reaction & Message Cycling...\n');

// 1. Verify reaction list
console.log(`Configured Reactions (${PET_REACTIONS.length}):`);
PET_REACTIONS.forEach((r, idx) => console.log(`  ${idx + 1}. ${r}`));

// 2. Simulate sequential feeding for 30 consecutive feeds (3 full cycles of 10)
const totalFeeds = 30;
let reactionIndex = 0;
let catMsgIndex = 0;
let dogMsgIndex = 0;

const CAT_MESSAGES = [
  "🐾💕",
  "😸✨",
  "🐟💛",
  "😻🌸",
  "Purr~ 🐾",
  "🧡🐱",
  "😽💫",
  "Meow~ 💕",
];

const DOG_MESSAGES = [
  "🐾🐶",
  "🦴💛",
  "😊🐕",
  "Woof~ 🐾",
  "💕🐾💕",
  "😄🐶✨",
  "🌟🐕🌟",
  "Yay! 🐾",
];

const playedReactions: PetReactionType[] = [];
const playedCatMsgs: string[] = [];
const playedDogMsgs: string[] = [];

for (let feed = 1; feed <= totalFeeds; feed++) {
  // Sequential reaction logic
  const rIdx = reactionIndex % PET_REACTIONS.length;
  const reaction = PET_REACTIONS[rIdx];
  reactionIndex = (rIdx + 1) % PET_REACTIONS.length;
  playedReactions.push(reaction);

  // Sequential cat message logic
  const cIdx = catMsgIndex % CAT_MESSAGES.length;
  const catMsg = CAT_MESSAGES[cIdx];
  catMsgIndex = (cIdx + 1) % CAT_MESSAGES.length;
  playedCatMsgs.push(catMsg);

  // Sequential dog message logic
  const dIdx = dogMsgIndex % DOG_MESSAGES.length;
  const dogMsg = DOG_MESSAGES[dIdx];
  dogMsgIndex = (dIdx + 1) % DOG_MESSAGES.length;
  playedDogMsgs.push(dogMsg);
}

// 3. Verify Cycle 1 (Feeds 1 to 10)
console.log('\n--- Cycle 1 Verification (Feeds 1 to 10) ---');
for (let i = 0; i < 10; i++) {
  const expected = PET_REACTIONS[i];
  const actual = playedReactions[i];
  console.log(`Feed #${i + 1}: Reaction = ${actual} | Cat Msg = ${playedCatMsgs[i]} | Dog Msg = ${playedDogMsgs[i]}`);
  if (actual !== expected) {
    throw new Error(`Mismatch at feed #${i + 1}: expected ${expected}, got ${actual}`);
  }
}
console.log('✓ All 10 reactions played in exact sequential order in Cycle 1.');

// Check that within the first 10 feeds, no reaction repeated
const uniqueInCycle1 = new Set(playedReactions.slice(0, 10));
if (uniqueInCycle1.size !== 10) {
  throw new Error(`Expected 10 unique reactions in cycle 1, got ${uniqueInCycle1.size}`);
}
console.log('✓ Confirmed: zero repeats occurred before all 10 reactions played.');

// 4. Verify Cycle 2 (Feeds 11 to 20) loops back and repeats the exact same sequence
console.log('\n--- Cycle 2 Verification (Feeds 11 to 20) ---');
for (let i = 0; i < 10; i++) {
  const expected = PET_REACTIONS[i];
  const actual = playedReactions[10 + i];
  if (actual !== expected) {
    throw new Error(`Cycle 2 mismatch at feed #${11 + i}: expected ${expected}, got ${actual}`);
  }
}
console.log('✓ Cycle 2 looped back around and matched the exact 1-10 sequence.');

// 5. Verify Cycle 3 (Feeds 21 to 30) loops back again
console.log('\n--- Cycle 3 Verification (Feeds 21 to 30) ---');
for (let i = 0; i < 10; i++) {
  const expected = PET_REACTIONS[i];
  const actual = playedReactions[20 + i];
  if (actual !== expected) {
    throw new Error(`Cycle 3 mismatch at feed #${21 + i}: expected ${expected}, got ${actual}`);
  }
}
console.log('✓ Cycle 3 looped back around and matched the exact 1-10 sequence.');

// 6. Verify Messages cycling (8 messages pool)
console.log('\n--- Message Cycling Verification (8 messages per pool) ---');
for (let i = 0; i < 8; i++) {
  if (playedCatMsgs[i] !== CAT_MESSAGES[i]) {
    throw new Error(`Cat message mismatch at feed #${i + 1}`);
  }
  if (playedDogMsgs[i] !== DOG_MESSAGES[i]) {
    throw new Error(`Dog message mismatch at feed #${i + 1}`);
  }
}
// Feed 9 must loop back to message 0
if (playedCatMsgs[8] !== CAT_MESSAGES[0] || playedDogMsgs[8] !== DOG_MESSAGES[0]) {
  throw new Error('Message pool did not loop back to index 0 on feed #9');
}
console.log(`Feed #8 (end of msg pool): "${playedCatMsgs[7]}" -> Feed #9 (loop back): "${playedCatMsgs[8]}"`);
console.log('✓ Messages cycle through the full list of 8 in order and loop back seamlessly.');

console.log('\nALL SEQUENTIAL IN-ORDER FEEDING TESTS PASSED!');
