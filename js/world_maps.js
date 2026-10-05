/* The maps of The Gilded Crown (written by tools/world/maps_src.py, do not edit by hand: change the script and run it
   again). Tile letters: see TILES in js/world.js. */
(function (root) {
  var WORLD_MAPS = {
 "greenmarch": {
  "name": "The Greenmarch",
  "rows": [
   "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
   "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
   "TTTTTTTTooTTTTTTTTTTTTTTT..\"XXXXXXXXX...TTTTTTTTTTTTTTTTTTTTTTTT",
   "TTTTToTooooooTTTTTTTTTTTT..\"XXXXXXXXX.\"\"TTTTTTTTTTTTTT.T.TTT.TTT",
   "TTTTooooooooooTTTT.TTTT.....XXXXXXXXX\"..TTTTTTTTT.T...,.,,.TTTTT",
   "TTTTToooooooooTT.TTTTTTTT.o.XXXXXXXXX...TTTTT.TTTTT..,.,,,,.TTTT",
   "TTToooooooooooooTTTTTTTTT..\"XXXXXXXXX\"..T.T.TT.TTTT,..,A..,TTTTT",
   "TTTTToooooooooooTT.TTTTTT...XXXXGXXXX\".\"TTTTTTTTTTT..,.,.,,TTTTT",
   "TTTTToooocooooo..TTT.TTTT...o.\"==.......TTT.TTTTTTT..,,.,,.TTTTT",
   "TTTTToo.....ooTTTTTTTTTTT......==\"...o..TTTTTTT..T..,,.,..,TTTTT",
   "TTTTTTT.....T.TT.TTTTTTT..\"..\".==..\"..\".T.TTT.TTTTTTTT.TTTTTTTTT",
   "TTTT....\".................\".,..==......\"......\".....,........TTT",
   "::..:..:.:::.:....:.....,......==.:..:..:........:::::::::::::..",
   "~~~~~~~~~~~~~~~~~~~:.....:::::~__~~~~~~~~.:.::::::~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~__~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "T:T:.:.:,:.....:.,,~~~~~~~~~~~\"__.....:.:~~~~~~~~~:::::::::::::T",
   "TTTT.\"...,...,.....:..,:..:.::.==.....,......::::::.......\"...TT",
   "TT....,....,,.........\".......,==..........,.........,.......\"TT",
   "TTTT...,...,...\"..............\"==t..t.,\".t...t............t.TTTT",
   "TTTT...........................==..o,.......................T.TT",
   "TT\"T.\".................,t.\"....==............\".t.,........t...TT",
   "TT.T.....................\"..,..==.\"............,,..:::::....TTTT",
   "TTTT......................t...,==.........,......:\",~:~::.....TT",
   "TT.T...............t.,...,.,...==.............,.::~~~~~~::::..TT",
   "TTT.||||||||||..\"t...,#########PP#########.\"...,,~~~~~~~~~~:..TT",
   "TT.T|........|........#^^^^^^^.PP.^^^^^^^#..\"..A~~~~~~~~~~~:T.TT",
   "TTT.|.n..n...|.....\"..#^^^^^^^.PP.^^^^^^^#o...::~~~~~~~~~~~:.TTT",
   "TTT.|........|....,\"..#^^^^^^^.PP.^^^^^^^#....,~~~~~~~~~~~~::TTT",
   "TTTT|...F.....=.......#HHHDHHH.PP.HHHHDHH#....:,~~~~~~~~~~~~:.TT",
   "TTT.|.........=.\".....#...PPWPPPPSPPP.P..#.....:~~~~~~~~~~~::\"TT",
   "TTTT|.n......|==========PPPPPPPPPPPPPPPPP========~~~~~~~~~::TTTT",
   "TT.,|.....n..|==========PPPPPPPPPPPPPPPPP========::~~~~~:~:,T.TT",
   "TTT.|........|........#^^^^^^PPPPPP^^^^^^#.......\"::::::::\"..TTT",
   "TTTT||||||||||......,,#^^^^^^..PPvv^^^^^^#..............^^^^T.TT",
   "TTTT..............,...#^^^^^^..PP..^^^^^^#......,.......^^^^T.TT",
   "TTTT..\"....,........\".#HHDHHH..PP..HHDHHH#....\"..,\"....\"HDHH..TT",
   "TTT...................#..P.....PP....P...#.......\"....o,....TTTT",
   "TTTT..........t,,....,#########==#########............t....\"TTTT",
   "TTT........,.....o.......t.....==...........................TTTT",
   "TT...,.....\".....,.....wwwwwwww==wwwwwwww......,..........\".TTTT",
   "TT..T.TT.T.,.T.TT.TTT,.wwwwwwww==wwwwwwwwT..T.TT..TTTTTT.T.TTTTT",
   "TT.TT...TTT.TTT..TT...Twwwwwwww==wSwwwwwwTTTTTTT.TTTTTTT.\"TT.TTT",
   "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT||||TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
   "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT==TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"
  ],
  "outdoor": true,
  "music": "field",
  "things": [
   {
    "t": "door",
    "x": 26,
    "y": 28,
    "to": "inn",
    "at": [
     5,
     7
    ]
   },
   {
    "t": "door",
    "x": 38,
    "y": 28,
    "to": "hall",
    "at": [
     5,
     6
    ]
   },
   {
    "t": "door",
    "x": 25,
    "y": 35,
    "to": "smith",
    "at": [
     3,
     5
    ]
   },
   {
    "t": "door",
    "x": 37,
    "y": 35,
    "to": "shop",
    "at": [
     3,
     5
    ]
   },
   {
    "t": "door",
    "x": 57,
    "y": 35,
    "to": "hut",
    "at": [
     2,
     4
    ]
   },
   {
    "t": "barred",
    "x": 32,
    "y": 7,
    "say": "tower_gate"
   },
   {
    "t": "barred",
    "x": 9,
    "y": 8,
    "say": "cave"
   },
   {
    "t": "sign",
    "x": 33,
    "y": 29,
    "say": "sign_town"
   },
   {
    "t": "sign",
    "x": 34,
    "y": 41,
    "say": "sign_south"
   },
   {
    "t": "look",
    "x": 55,
    "y": 6,
    "say": "altar"
   },
   {
    "t": "look",
    "x": 47,
    "y": 25,
    "say": "shrine"
   },
   {
    "t": "look",
    "x": 8,
    "y": 28,
    "say": "campfire"
   },
   {
    "t": "look",
    "x": 28,
    "y": 29,
    "say": "well"
   },
   {
    "t": "npc",
    "id": "tomas",
    "name": "Tomas, the gate guard",
    "piece": "R",
    "x": 33,
    "y": 23,
    "say": "tomas",
    "face": "s"
   },
   {
    "t": "npc",
    "id": "old_wen",
    "name": "Old Wen",
    "piece": "P",
    "x": 30,
    "y": 32,
    "say": "old_wen",
    "face": "e",
    "wander": 2
   },
   {
    "t": "npc",
    "id": "ida",
    "name": "Ida, a farmer",
    "piece": "P",
    "x": 29,
    "y": 40,
    "say": "ida",
    "face": "n",
    "wander": 2
   },
   {
    "t": "npc",
    "id": "bridge_guard",
    "name": "A tired guard",
    "piece": "R",
    "x": 33,
    "y": 16,
    "say": "bridge_guard",
    "face": "w"
   },
   {
    "t": "npc",
    "id": "bandit_look",
    "name": "A bandit",
    "piece": "n",
    "x": 14,
    "y": 27,
    "say": "bandit",
    "face": "e"
   },
   {
    "t": "npc",
    "id": "bandit_look2",
    "name": "A bandit",
    "piece": "p",
    "x": 14,
    "y": 30,
    "say": "bandit",
    "face": "e"
   }
  ]
 },
 "inn": {
  "name": "The Last Crown",
  "rows": [
   "############",
   "#bfbf#ffKff#",
   "#ffffffffff#",
   "#ffkffffkff#",
   "#ffffRRffff#",
   "#CCCfRRffkf#",
   "#fffffffffv#",
   "#fffffffffv#",
   "#####D######"
  ],
  "music": "inn",
  "things": [
   {
    "t": "door",
    "x": 5,
    "y": 8,
    "to": "greenmarch",
    "at": [
     26,
     29
    ]
   },
   {
    "t": "npc",
    "id": "mara",
    "name": "Mara, the innkeeper",
    "piece": "Q",
    "x": 2,
    "y": 4,
    "say": "mara",
    "face": "s"
   },
   {
    "t": "npc",
    "id": "traveller",
    "name": "A traveller",
    "piece": "N",
    "x": 8,
    "y": 4,
    "say": "traveller",
    "face": "w"
   },
   {
    "t": "look",
    "x": 8,
    "y": 1,
    "say": "fireplace"
   },
   {
    "t": "look",
    "x": 1,
    "y": 1,
    "say": "bed"
   }
  ]
 },
 "hall": {
  "name": "The recruit hall",
  "rows": [
   "###########",
   "#!fff!fff!#",
   "#fffffffff#",
   "#fCCCCCCCf#",
   "#fffffffff#",
   "#kfffffffk#",
   "#fffffffff#",
   "#####D#####"
  ],
  "music": "inn",
  "things": [
   {
    "t": "door",
    "x": 5,
    "y": 7,
    "to": "greenmarch",
    "at": [
     38,
     29
    ]
   },
   {
    "t": "npc",
    "id": "recruiter",
    "name": "Captain Holt",
    "piece": "R",
    "x": 5,
    "y": 2,
    "say": "recruiter",
    "face": "s"
   },
   {
    "t": "look",
    "x": 1,
    "y": 1,
    "say": "banner"
   }
  ]
 },
 "smith": {
  "name": "The smithy",
  "rows": [
   "#########",
   "#KKfffvv#",
   "#fafffff#",
   "#fffffff#",
   "#fffffff#",
   "#ffffffv#",
   "###D#####"
  ],
  "music": "inn",
  "things": [
   {
    "t": "door",
    "x": 3,
    "y": 6,
    "to": "greenmarch",
    "at": [
     25,
     36
    ]
   },
   {
    "t": "npc",
    "id": "smith",
    "name": "Brann, the smith",
    "piece": "B",
    "x": 3,
    "y": 2,
    "say": "smith",
    "face": "s"
   },
   {
    "t": "look",
    "x": 2,
    "y": 2,
    "say": "anvil"
   }
  ]
 },
 "shop": {
  "name": "The shop",
  "rows": [
   "#########",
   "#vvfffvv#",
   "#CCCCCCf#",
   "#fffffff#",
   "#ffRRfff#",
   "#fffffff#",
   "###D#####"
  ],
  "music": "inn",
  "things": [
   {
    "t": "door",
    "x": 3,
    "y": 6,
    "to": "greenmarch",
    "at": [
     37,
     36
    ]
   },
   {
    "t": "npc",
    "id": "shopkeeper",
    "name": "Lisbet, the shopkeeper",
    "piece": "P",
    "x": 4,
    "y": 1,
    "say": "shopkeeper",
    "face": "s"
   }
  ]
 },
 "hut": {
  "name": "The hermit's hut",
  "rows": [
   "#######",
   "#bffKf#",
   "#fffff#",
   "#fkfff#",
   "#fffff#",
   "##D####"
  ],
  "music": "lake",
  "things": [
   {
    "t": "door",
    "x": 2,
    "y": 5,
    "to": "greenmarch",
    "at": [
     57,
     36
    ]
   },
   {
    "t": "npc",
    "id": "hermit",
    "name": "The hermit",
    "piece": "b",
    "x": 3,
    "y": 2,
    "say": "hermit",
    "face": "s"
   }
  ]
 }
};
  var WORLD_SAY = {
 "intro": [
  {
   "lines": [
    "The rulers of the Chesslands are gold now. Statues on their thrones, cold and still.",
    "A sorcerer did it. People call him the Gilder. Nobody who saw his face has spoken of it.",
    "One crown is still wood. Yours.",
    "You wake in the inn of Ashford, at the edge of the Greenmarch."
   ]
  }
 ],
 "mara": [
  {
   "not": "met_mara",
   "set": "met_mara",
   "lines": [
    "You slept two days. The road guard found you by the river, half in the water.",
    "Your crown is not gold. Keep it under your hood. The Gilder's wardens ask about crowns.",
    "The Queen of the Greenmarch sits in the old tower north of the river. Gold, like the others.",
    "A man calls himself the Rook Lord now. He holds the tower for the Gilder.",
    "Rest here when you need it. The room is yours."
   ]
  },
  {
   "lines": [
    "Rest when you need it. The room is yours.",
    "The tower is north, over the bridge. Do not go alone."
   ]
  }
 ],
 "traveller": [
  {
   "lines": [
    "I came from the east. Every throne on the way was gold.",
    "In one town they still bow to the statue every morning. They do not know what else to do."
   ]
  }
 ],
 "tomas": [
  {
   "lines": [
    "The north gate. The bridge is open, but the tower woods are not safe.",
    "Bandits in the west, wild pieces in the fields. Stay on the road if you are smart."
   ]
  }
 ],
 "old_wen": [
  {
   "lines": [
    "My grandson's pawn ran off into the forest. Little thing, it gets scared.",
    "If you see a pawn alone out there, send it home. Please."
   ]
  }
 ],
 "ida": [
  {
   "lines": [
    "The bandits in the west took half the harvest.",
    "Nobody stops them anymore. There is nobody left to stop them."
   ]
  }
 ],
 "bridge_guard": [
  {
   "lines": [
    "Past this bridge it is the Rook Lord's land.",
    "His towers do not come down the road. They wait in the woods."
   ]
  }
 ],
 "bandit": [
  {
   "lines": [
    "Turn around, wood king.",
    "Come back with an army, or do not come back."
   ]
  }
 ],
 "recruiter": [
  {
   "lines": [
    "Pieces want pay these days. Loyalty died with the thrones.",
    "Come back with gold and I will find you soldiers."
   ]
  }
 ],
 "smith": [
  {
   "lines": [
    "A piece can be made more than it is. A pawn can learn to march, a knight to ride harder.",
    "That costs iron and gold. I have the iron."
   ]
  }
 ],
 "shopkeeper": [
  {
   "lines": [
    "Not much to sell. The carts stopped coming when the Queen turned.",
    "Come back later. Maybe the road opens again."
   ]
  }
 ],
 "hermit": [
  {
   "lines": [
    "The lake is older than the kingdom. Sit, if you like.",
    "Gold is only a colour. The Gilder forgot that once. Remember it for him."
   ]
  }
 ],
 "tower_gate": [
  {
   "lines": [
    "The gate is barred from inside. Something heavy holds it."
   ]
  }
 ],
 "cave": [
  {
   "lines": [
    "Cold air comes out of the dark. You hear water far below."
   ]
  }
 ],
 "sign_town": [
  {
   "lines": [
    "Ashford. The Last Crown inn, the recruit hall, the smithy, the shop."
   ]
  }
 ],
 "sign_south": [
  {
   "lines": [
    "The south road is closed by order of the Gilder's wardens."
   ]
  }
 ],
 "altar": [
  {
   "lines": [
    "An old stone, worn smooth by rain. It hums very quietly."
   ]
  }
 ],
 "shrine": [
  {
   "lines": [
    "A small shrine. Carved into it: a board with three pieces on it."
   ]
  }
 ],
 "campfire": [
  {
   "lines": [
    "The fire is still warm."
   ]
  }
 ],
 "well": [
  {
   "lines": [
    "The town well. The water is clear and cold."
   ]
  }
 ],
 "fireplace": [
  {
   "lines": [
    "The fire crackles. For a moment it is easy to forget the gold."
   ]
  }
 ],
 "bed": [
  {
   "lines": [
    "Your bed. You slept here two days."
   ]
  }
 ],
 "banner": [
  {
   "lines": [
    "An old banner of the Greenmarch: a green field, a white crown."
   ]
  }
 ],
 "anvil": [
  {
   "lines": [
    "A heavy anvil, black with use."
   ]
  }
 ]
};
  var WORLD_START = {"map": "inn", "x": 3, "y": 4, "dir": "w"};
  var api = { MAPS: WORLD_MAPS, SAY: WORLD_SAY, START: WORLD_START };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorldMaps = api;
})(typeof self !== 'undefined' ? self : this);
