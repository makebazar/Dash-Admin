let cumulative = 0;
let roll = 90; 
let wonPrize = null;
const prizes = [
  {id: 1, probability: 50, daily_limit: 1},
  {id: 2, probability: 50, daily_limit: 0}
];
for (const prize of prizes) {
  if (prize.daily_limit > 0) {
    // simulate daily limit reached
    if (prize.id === 1) continue; 
  }
  cumulative += parseFloat(prize.probability);
  if (roll <= cumulative) {
    wonPrize = prize;
    break;
  }
}
console.log(wonPrize);
