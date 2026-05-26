const prizes = [
  {id: 1, probability: "50.00"},
  {id: 2, probability: "50.00"}
];
let cumulative = 0;
let roll = 100;
let wonPrize = null;

for (const prize of prizes) {
  cumulative += parseFloat(prize.probability);
  if (roll <= cumulative) {
    wonPrize = prize;
    break;
  }
}
console.log(wonPrize);
