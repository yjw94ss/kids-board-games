const animalRows = [
  ['小旗', '背影', '小熊', '小熊', '背影', '背影', '背影', '背影', '背影', '背影', '奖杯'],
  ['小熊', '背影', '小熊', '小熊', '小熊', '背影', '小兔', '小兔', '小熊', '小兔', '背影'],
  ['小熊', '小熊', '背影', '小猫', '小狗', '小狗', '小兔', '小狗', '大象', '小兔', '小狐狸'],
  ['小旗', '背影', '背影', '小狗', '小狗', '背影', '小狗', '小狗', '大象', '小狐狸', '奖杯'],
];
const counting = [];
const animalY = [146, 430, 710, 945];
for (let row = 0; row < 4; row++) {
  const cols = Array.from({length:11}, (_, i) => row % 2 ? 10 - i : i);
  for (const col of cols) counting.push({ x:105 + col*128, y:animalY[row], label:animalRows[row][col], row });
  if (row < 3) counting.push({x:row%2 ? 105 : 1385, y:[287, 571, 827][row], label:['小狐狸','小熊','背影'][row], row:row+.5});
}
counting[0].label = '起点';
counting[counting.length-1].label = '终点';

// Coordinates refer to the unscaled 1491 × 1055 artwork.
const literacy = [
  [1050,153,'起点'], [904,153,'白'], [766,153,'海'], [615,153,'空格'], [472,153,'万'], [325,153,'千'],
  [325,258,'前进两格',2], [325,365,'树'], [475,365,'江'], [620,365,'火把'], [768,365,'高'], [915,365,'农'], [1065,365,'马'], [1213,365,'前进一格',1],
  [1217,465,'下'], [1213,565,'前进一格',1], [1070,565,'时'], [922,565,'花朵'], [768,565,'云'], [610,565,'火把'], [455,565,'门'], [305,565,'前进一格',1],
  [305,665,'火把'], [305,765,'岁'], [455,765,'日'], [608,765,'花朵'], [768,765,'二'], [917,765,'前进二格',2], [1055,765,'空格'], [1205,765,'红'], [1366,765,'村'],
  [1370,867,'一'], [1370,969,'楼'], [1217,969,'秋'], [1043,969,'花朵'], [879,969,'火把'], [719,969,'月'], [555,969,'明'], [367,969,'终点'],
].map(([x,y,label,advance])=>({x,y,label,...(advance?{advance}:{})}));
literacy[3].jump = 8;
literacy[28].jump = 33;

export const boards = {
  counting:{id:'counting',name:'快乐点数棋',subtitle:'数一数，向前走',image:'assets/counting.png',width:1491,height:1055,cells:counting,theme:'gold'},
  literacy:{id:'literacy',name:'经典飞行棋',subtitle:'读汉字，走到小屋',image:'assets/literacy.png',width:1491,height:1055,cells:literacy,theme:'green'},
};
