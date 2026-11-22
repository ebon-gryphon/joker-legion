// Final poker score sets the grade of every recruit issued by this hand.
export const GRADES = [
  {name:'常备', min:0,   boost:0,  xp:0, color:'#ebe1cf'},
  {name:'精良', min:50,  boost:12, xp:1, color:'#a5dfbc'},
  {name:'稀有', min:140, boost:25, xp:2, color:'#9dcfff'},
  {name:'卓越', min:320, boost:40, xp:3, color:'#dbc0ff'},
  {name:'传说', min:800, boost:60, xp:5, color:'#ffce78'},
]
export const QUALITIES = [...GRADES,
  {name:'神话', xp:10, color:'#8eeae5'},
  {name:'棱彩', xp:18, color:'#ffc0ed'},
]
export function ascendedGrade(leader, donor) {
  return leader && donor && leader.grade >= 4 && leader.grade === donor.grade &&
    QUALITIES[leader.grade + 1] ? leader.grade + 1 : null
}
export const gradeForScore = score => GRADES.findLastIndex(g => score >= g.min)
export const gradeOf = unit => QUALITIES[unit?.grade ?? 0]
