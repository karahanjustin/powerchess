/* Chess variants. Rules come from ffish (the Fairy-Stockfish rules library),
   the opponent is Fairy-Stockfish itself (see Engine.initFairy).
   Boards can be any size up to 12 files, squares are r * W + f with row 0 on top. */
(function (root) {
  'use strict';

  var FILES = 'abcdefghijklmnopqrstuvwxyz'; // variants go up to 12 files, the editor's boards up to 26
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // How compound pieces are drawn: base piece plus a small badge.
  /* How a variant letter is drawn: [base piece, badge, picture]. The picture is a fairy piece of its own
     under pieces/fairy/ and is used when it exists; base and badge are the fallback and tell the
     coach what the piece is made of. */
  var ARCH = ['B', 'N', 'archbishop'], CHAN = ['R', 'N', 'chancellor'], AMAZON = ['Q', 'N', 'amazon'];
  var ELEPHANT = ['B', '', 'elephant'], WIZARD = ['N', '', 'wizard'], CHAMPION = ['R', '', 'champion'], COMMONER = ['K', 'P', 'commoner'], FERZ = ['Q', '', 'ferz'], WAZIR = ['R', '', 'wazir'];

  var VARIANTS = [
    { id: 'chess', group: 'Classic', name: 'Standard chess', fen: START,
      desc: 'Normal rules. The only mode Stockfish 19 can play. Like the two Dice Chess modes, it starts from the board editor\'s position.' },
    { id: 'dice', std: true, dice: true, group: 'Classic', name: 'Dice Chess', fen: START,
      desc: 'At the start of every turn you roll two dice. Each shows a kind of piece, from the kinds on the board, all equally likely. You may only move a piece one of them shows. A roll that allows nothing is thrown again. Works with both engines, power-ups and the board editor.' },
    { id: 'dice3', std: true, dice: true, dice3: true, group: 'Classic', name: 'Dice Chess, three dice', fen: START,
      desc: 'At the start of every turn you roll three dice, and all three have to be used: one move per die, in any order. Pawn, pawn, bishop means two pawn moves and a bishop move, so one of the pawns had better free the bishop. A die that cannot be used any more is lost. There is no check: the king is simply taken.' },
    { id: 'duck', std: true, duckChess: true, group: 'Classic', name: 'Duck Chess', fen: START,
      desc: 'After every move you also move the duck, a yellow piece that belongs to nobody, onto another free square. Nothing passes or takes it, a knight jumps over it. The duck comes onto the board after White\'s first move. There is no check: you win by taking the king, and a side without a legal move wins. Starts from the board editor\'s position, where more ducks can be put, yellow ones that all have to move and blue ones that may. Played by the app\'s own engine.' },
    { id: 'checkers', checkers: true, group: 'Classic', name: 'Checkers', fen: '1є1є1є1є/є1є1є1є1/1є1є1є1є/8/8/Є1Є1Є1Є1/1Є1Є1Є1Є/Є1Є1Є1Є1 w - - 0 1',
      desc: 'Plain checkers (draughts) on the dark squares. Men move one square diagonally forward and take by jumping over a piece onto the empty square behind it, on and on while another jump is there. Taking is a must. A man that reaches the far row is crowned a king, which moves and jumps both ways. Who cannot move loses. White starts. Played by the app\'s own engine.' },
    { id: 'chess960', uci: 'chess', c960: true, group: 'Classic', name: 'Chess960', fen: START,
      desc: 'Random back rank, same rules. To castle, select your king and click the rook.' },

    { id: 'crazyhouse', group: 'New rules, same pieces', name: 'Crazyhouse', drops: true, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1',
      desc: 'Captured pieces change sides. Drop one back on the board instead of moving.' },
    { id: 'atomic', special: true, group: 'New rules, same pieces', name: 'Atomic', boom: true, fen: START,
      desc: 'Every capture explodes and takes the surrounding pieces with it. Blow up the king to win.' },
    { id: 'kingofthehill', special: true, group: 'New rules, same pieces', name: 'King of the Hill', fen: START,
      desc: 'Walk your king onto one of the four center squares and you win.' },
    { id: '3check', special: true, group: 'New rules, same pieces', name: 'Three-check', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 3+3 0 1',
      desc: 'Give check three times and you win.' },
    { id: 'antichess', inverse: true, special: true, nocheck: true, group: 'New rules, same pieces', name: 'Antichess', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
      desc: 'Captures are forced and the king is just a piece. Lose everything to win.' },
    { id: 'losers', inverse: true, special: true, group: 'New rules, same pieces', name: 'Losers', fen: START,
      desc: 'Captures are forced. Lose all your pieces or get checkmated to win.' },
    { id: 'horde', special: true, group: 'New rules, same pieces', name: 'Horde', fen: 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1',
      desc: 'White is a horde of 36 pawns without a king. Black wins by capturing all of them.' },
    { id: 'racingkings', special: true, nocheck: true, group: 'New rules, same pieces', name: 'Racing Kings', fen: '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1',
      desc: 'Checks are forbidden. The first king to reach the eighth rank wins.' },
    { id: 'extinction', special: true, nocheck: true, group: 'New rules, same pieces', name: 'Extinction', fen: START,
      desc: 'Wipe out any one kind of enemy piece, for example both knights, and you win.' },
    { id: 'torpedo', group: 'New rules, same pieces', name: 'Torpedo', fen: START,
      desc: 'Pawns may move two squares from anywhere, not only from their start.' },
    { id: 'berolina', group: 'New rules, same pieces', name: 'Berolina', fen: START,
      desc: 'Pawns move diagonally and capture straight ahead.' },
    { id: 'hoppelpoppel', group: 'New rules, same pieces', name: 'Hoppel-Poppel', fen: START,
      desc: 'Knights capture like bishops and bishops capture like knights.' },
    { id: 'pocketknight', group: 'New rules, same pieces', name: 'Pocket Knight', drops: true, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[Nn] w KQkq - 0 1',
      desc: 'Each side holds one spare knight that can be dropped on the board at any time.' },

    { id: '5check', special: true, group: 'New rules, same pieces', name: 'Five-check', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5+5 0 1',
      desc: 'Like Three-check, but it takes five checks to win.' },
    { id: 'nocastle', group: 'New rules, same pieces', name: 'No Castling', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
      desc: 'Normal chess without castling. The kings have to find safety on foot.' },
    { id: 'armageddon', special: true, group: 'New rules, same pieces', name: 'Armageddon', fen: START,
      desc: 'A draw counts as a win for Black, so White has to win outright.' },
    { id: 'coregal', special: true, group: 'New rules, same pieces', name: 'Coregal', fen: START,
      desc: 'The queen is royal too: she can be checked, and she may be checkmated like a king.' },
    { id: 'threekings', special: true, group: 'New rules, same pieces', name: 'Three Kings', fen: 'knbqkbnk/pppppppp/8/8/8/8/PPPPPPPP/KNBQKBNK w - - 0 1',
      desc: 'Each side has three kings instead of rooks. Losing any one of them loses the game.' },
    { id: 'kinglet', special: true, nocheck: true, group: 'New rules, same pieces', name: 'Kinglet', fen: START,
      desc: 'The king is an ordinary piece. You lose when all your pawns are gone.' },
    { id: 'giveaway', inverse: true, special: true, nocheck: true, group: 'New rules, same pieces', name: 'Giveaway', fen: START,
      desc: 'Antichess with castling: captures are forced and losing everything wins.' },
    { id: 'nocheckatomic', special: true, nocheck: true, boom: true, group: 'New rules, same pieces', name: 'Atomic, no checks', fen: START,
      desc: 'Atomic without the check rule. Only an explosion next to the king ends the game.' },
    { id: 'pawnsideways', group: 'New rules, same pieces', name: 'Sideways Pawns', fen: START,
      desc: 'Pawns may also step one square to the side.' },
    { id: 'pawnback', group: 'New rules, same pieces', name: 'Pawn Back', fen: START,
      desc: 'Pawns may also step one square backwards.' },
    { id: 'legan', group: 'New rules, same pieces', name: 'Legan Chess', fen: 'knbrp3/bqpp4/npp5/rp1p3P/p3P1PR/5PPN/4PPQB/3PRBNK w - - 0 1',
      desc: 'The armies start in opposite corners and the pawns march diagonally towards each other.' },
    { id: 'newzealand', group: 'New rules, same pieces', name: 'New Zealand', fen: START,
      desc: 'Rooks capture like knights and knights capture like rooks.' },
    { id: 'chessgi', group: 'New rules, same pieces', name: 'Chessgi', drops: true, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1',
      desc: 'Crazyhouse where pawns may even be dropped on your own back rank.' },
    { id: 'loop', group: 'New rules, same pieces', name: 'Loop Chess', drops: true, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1',
      desc: 'Crazyhouse where a captured promoted piece stays what it became.' },
    { id: 'breakthrough', special: true, nocheck: true, group: 'New rules, same pieces', name: 'Breakthrough', fen: 'pppppppp/pppppppp/8/8/8/8/PPPPPPPP/PPPPPPPP w 0 1',
      desc: 'Pawns only, no kings. The first pawn to reach the far side wins.' },

    { id: 'placement', special: true, drops: true, group: 'New rules, same pieces', name: 'Placement Chess', fen: '8/pppppppp/8/8/8/8/PPPPPPPP/8[KQRRBBNNkqrrbbnn] w - - 0 1',
      desc: 'The back ranks start empty. The two sides take turns placing their pieces from the pocket, then play on as usual.' },
    { id: 'suicide', inverse: true, special: true, nocheck: true, group: 'New rules, same pieces', name: 'Suicide Chess', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
      desc: 'Antichess where a stalemate is won by whoever has fewer pieces left.' },
    { id: 'misere', nobrain: true, special: true, group: 'New rules, same pieces', name: 'Misere Chess', fen: START,
      desc: 'Normal moves, reversed goal: you win by getting yourself checkmated.' },

    { id: 'seirawan', special: true, keepCastle: true, group: 'New pieces', name: 'Seirawan Chess', glyphs: { h: ARCH, e: CHAN },
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[HEhe] w KQBCDFGkqbcdfg - 0 1',
      desc: 'Each side holds a hawk (bishop plus knight) and an elephant (rook plus knight). When a back rank piece moves for the first time, one of them may step onto the square it left. The menu that pops up is that choice.' },
    { id: 'dragon', drops: true, group: 'New pieces', name: 'Dragon Chess', glyphs: { d: ['N', 'Q', 'dragon'] }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[Dd] w KQkq - 0 1',
      desc: 'Each side holds one dragon (D) in the pocket and may drop it on its own back rank instead of moving.' },
    { id: 'shatar', group: 'New pieces', name: 'Shatar', glyphs: { j: ['R', 'K'] }, fen: 'rnbjkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBJKBNR w - - 0 1',
      desc: 'Mongolian chess. The queen is replaced by the bers, a rook that also steps one square diagonally.' },
    { id: 'chaturanga', group: 'New pieces', name: 'Chaturanga', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
      desc: 'The ancient Indian game all chess descends from, with short-stepping queens and jumping bishops.' },
    { id: 'cambodian', keepCastle: true, group: 'New pieces', name: 'Ouk Chaktrang', glyphs: { s: ['B'], m: ['Q'] }, fen: 'rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR w DEde - 0 1',
      desc: 'Cambodian chess. Like Makruk, but king and queen each have one special leap on their first move.' },
    { id: 'makpong', group: 'New pieces', name: 'Makpong', glyphs: { s: ['B'], m: ['Q'] }, fen: 'rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR w - - 0 1',
      desc: 'Makruk where a king in check may not move: it has to be defended another way.' },
    { id: 'ai-wok', group: 'New pieces', name: 'Ai-Wok', glyphs: { s: ['B'], a: CHAN }, fen: 'rnsaksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKASNR w - - 0 1',
      desc: 'Makruk with a far stronger queen that moves like rook and knight combined.' },
    { id: 'sittuyin', special: true, drops: true, group: 'New pieces', name: 'Sittuyin', glyphs: { s: ['B'], f: ['Q'] }, fen: '8/8/4pppp/pppp4/4PPPP/PPPP4/8/8[KFRRSSNNkfrrssnn] w - - 0 1',
      desc: 'Burmese chess. Only the pawns are on the board, each side first arranges its pieces behind them from the pocket.' },

    { id: 'nightrider', group: 'New pieces', name: 'Nightrider Chess', glyphs: { n: ['N', 'N', 'nightrider'] }, fen: START,
      desc: 'Knights are nightriders: they keep jumping in the same direction until something is in the way.' },
    { id: 'grasshopper', group: 'New pieces', name: 'Grasshopper Chess', fen: 'rnbqkbnr/gggggggg/pppppppp/8/8/PPPPPPPP/GGGGGGGG/RNBQKBNR w KQkq - 0 1',
      desc: 'Each side adds a row of grasshoppers (G). They move on queen lines but must hop over a piece and land right behind it.' },
    { id: 'perfect', group: 'New pieces', name: 'Perfect Chess', glyphs: { c: CHAN, m: AMAZON, g: ARCH }, fen: 'cmqgkbnr/pppppppp/8/8/8/8/PPPPPPPP/CMQGKBNR w KQkq - 0 1',
      desc: 'Every combination of rook, bishop and knight is on the board: chancellor, archbishop, queen and amazon.' },
    { id: 'shatranj', group: 'New pieces', name: 'Shatranj', fen: 'rnbkqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKQBNR w - - 0 1',
      desc: 'The medieval ancestor of chess. The bishop jumps exactly two squares diagonally, the queen moves one square diagonally.' },
    { id: 'makruk', group: 'New pieces', name: 'Makruk', glyphs: { s: ['B'], m: ['Q'] }, fen: 'rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR w - - 0 1',
      desc: 'Thai chess. Pawns start on the third rank, the bishop-like piece steps one square diagonally or straight ahead.' },
    { id: 'asean', group: 'New pieces', name: 'ASEAN Chess', fen: 'rnbqkbnr/8/pppppppp/8/8/PPPPPPPP/8/RNBQKBNR w - - 0 1',
      desc: 'A modern relative of Makruk with the same short-stepping bishops and queens.' },

    { id: 'amazon', group: 'New pieces', name: 'Amazon', glyphs: { a: AMAZON }, fen: 'rnbakbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBAKBNR w KQkq - 0 1',
      desc: 'The queen becomes an amazon: a queen that also jumps like a knight.' },
    { id: 'almost', group: 'New pieces', name: 'Almost Chess', glyphs: { c: CHAN }, fen: 'rnbckbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBCKBNR w KQkq - 0 1',
      desc: 'Queens are replaced by chancellors, a rook and knight in one piece.' },
    { id: 'chigorin', group: 'New pieces', name: 'Chigorin', glyphs: { c: CHAN }, fen: 'rbbqkbbr/pppppppp/8/8/8/8/PPPPPPPP/RNNCKNNR w KQkq - 0 1',
      desc: 'White has four knights and a chancellor, Black four bishops and a queen.' },
    { id: 'knightmate', group: 'New pieces', name: 'Knightmate', glyphs: { k: ['K', 'N'], m: COMMONER }, fen: 'rmbqkbmr/pppppppp/8/8/8/8/PPPPPPPP/RMBQKBMR w KQkq - 0 1',
      desc: 'The king moves like a knight. The knights are replaced by commoners that move like a king.' },

    { id: 'capablanca', group: 'Other boards', name: 'Capablanca', glyphs: { a: ARCH, c: CHAN }, fen: 'rnabqkbcnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNABQKBCNR w KQkq - 0 1',
      desc: '10x8 board with an archbishop (bishop plus knight) and a chancellor (rook plus knight).' },
    { id: 'gothic', group: 'Other boards', name: 'Gothic', glyphs: { a: ARCH, c: CHAN }, fen: 'rnbqckabnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNBQCKABNR w KQkq - 0 1',
      desc: 'The same 10x8 army as Capablanca in a sharper starting setup.' },
    { id: 'janus', group: 'Other boards', name: 'Janus', glyphs: { j: ARCH }, fen: 'rjnbkqbnjr/pppppppppp/10/10/10/10/PPPPPPPPPP/RJNBKQBNJR w KQkq - 0 1',
      desc: '10x8 board with two januses per side, bishop plus knight.' },
    { id: 'capahouse', group: 'Other boards', name: 'Capahouse', drops: true, glyphs: { a: ARCH, c: CHAN }, fen: 'rnabqkbcnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNABQKBCNR[] w KQkq - 0 1',
      desc: 'Capablanca chess with Crazyhouse drops.' },
    { id: 'grand', group: 'Other boards', name: 'Grand Chess', glyphs: { a: ARCH, c: CHAN }, fen: 'r8r/1nbqkcabn1/pppppppppp/10/10/10/10/PPPPPPPPPP/1NBQKCABN1/R8R w - - 0 1',
      desc: '10x10 board, archbishop and chancellor, no castling. Pawns may promote from the eighth rank on.' },
    { id: 'modern', group: 'Other boards', name: 'Modern Chess', glyphs: { m: ARCH }, fen: 'rnbqkmbnr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBMKQBNR w KQkq - 0 1',
      desc: '9x9 board with a minister, bishop plus knight, next to the king.' },
    { id: 'losalamos', group: 'Other boards', name: 'Los Alamos', fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
      desc: '6x6 board without bishops, the first chess a computer ever played.' },
    { id: 'gardner', group: 'Other boards', name: 'Gardner Minichess', fen: 'rnbqk/ppppp/5/PPPPP/RNBQK w - - 0 1',
      desc: '5x5 board, all the pieces, no double step and no castling.' },

    { id: 'embassy', group: 'Other boards', name: 'Embassy', glyphs: { a: ARCH, c: CHAN }, fen: 'rnbqkcabnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNBQKCABNR w KQkq - 0 1',
      desc: 'The Grand Chess army squeezed onto a 10x8 board, with castling.' },
    { id: 'centaur', group: 'Other boards', name: 'Centaur Chess', glyphs: { c: ['N', 'K', 'centaur'] }, fen: 'rcnbqkbncr/pppppppppp/10/10/10/10/PPPPPPPPPP/RCNBQKBNCR w KQkq - 0 1',
      desc: '10x8 board with two centaurs per side, a knight and king in one piece.' },
    { id: 'chancellor', group: 'Other boards', name: 'Chancellor Chess', glyphs: { c: CHAN }, fen: 'rnbqkcnbr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKCNBR w KQkq - 0 1',
      desc: '9x9 board with a chancellor, rook plus knight, next to the king.' },
    { id: 'shako', group: 'Other boards', name: 'Shako', glyphs: { e: ELEPHANT }, fen: 'c8c/ernbqkbnre/pppppppppp/10/10/10/10/PPPPPPPPPP/ERNBQKBNRE/C8C w KQkq - 0 1',
      desc: '10x10 board with cannons (C) that capture by jumping over a piece, and elephants (E).' },
    { id: 'courier', group: 'Other boards', name: 'Courier Chess', glyphs: { e: ELEPHANT, m: COMMONER, w: WAZIR, f: FERZ }, fen: 'rnebmk1wbenr/1ppppp1pppp1/6f5/p5p4p/P5P4P/6F5/1PPPPP1PPPP1/RNEBMK1WBENR w - - 0 1',
      desc: 'A 12x8 game from the Middle Ages with elephants, a man, a wazir and a ferz next to the usual pieces.' },
    { id: 'tencubed', group: 'Other boards', name: 'TenCubed', glyphs: { a: ARCH, m: CHAN, c: CHAMPION, w: WIZARD }, fen: '2cwamwc2/1rnbqkbnr1/pppppppppp/10/10/10/10/PPPPPPPPPP/1RNBQKBNR1/2CWAMWC2 w - - 0 1',
      desc: '10x10 board with an archbishop, a marshal, champions (C) and wizards (W) behind the usual army.' },
    { id: 'opulent', group: 'Other boards', name: 'Opulent Chess', glyphs: { a: ARCH, c: CHAN, w: WIZARD }, fen: 'rw6wr/clbnqknbla/pppppppppp/10/10/10/10/PPPPPPPPPP/CLBNQKNBLA/RW6WR w - - 0 1',
      desc: '10x10 board with chancellor, archbishop, lions (L) and wizards (W).' },
    { id: 'jesonmor', special: true, nocheck: true, group: 'Other boards', name: 'Jeson Mor', fen: 'nnnnnnnnn/9/9/9/9/9/9/9/NNNNNNNNN w - - 0 1',
      desc: '9x9 board, nine knights each. Win by reaching the center square and leaving it again.' },

    { id: 'custom', group: 'Build your own', name: 'Custom variant', fen: START,
      desc: 'Define your own pieces, board size and starting position in Fairy-Stockfish variant syntax.' }
  ];

  var TEMPLATES = [
    { name: 'Nightriders (8x8)', ini:
      '# Knights are replaced by nightriders: they keep jumping in the same direction.\n' +
      '# glyphs: w=N+N\n' +
      '[nightriders:chess]\n' +
      'customPiece1 = w:NN\n' +
      'startFen = rwbqkbwr/pppppppp/8/8/8/8/PPPPPPPP/RWBQKBWR w KQkq - 0 1\n' +
      'promotionPieceTypes = qrbw\n' },
    { name: 'Camel cavalry (10x8)', ini:
      '# A wider board with camels (3,1 leapers) next to the rooks.\n' +
      '# Pieces without a glyph line are drawn as a disc with their letter.\n' +
      '[camels:chess]\n' +
      'maxFile = 10\n' +
      'customPiece1 = c:C\n' +
      'castlingKingsideFile = i\n' +
      'castlingQueensideFile = c\n' +
      'startFen = rcnbqkbncr/pppppppppp/10/10/10/10/PPPPPPPPPP/RCNBQKBNCR w KQkq - 0 1\n' +
      'promotionPieceTypes = qrbnc\n' },
    { name: 'Amazon grand (10x10)', ini:
      '# 10x10 board. White swaps the queen for an amazon, both sides get\n' +
      '# an archbishop (h) and a chancellor (e).\n' +
      '# glyphs: a=Q+N h=B+N e=R+N\n' +
      '[amazongrand:chess]\n' +
      'maxRank = 10\n' +
      'maxFile = 10\n' +
      'amazon = a\n' +
      'archbishop = h\n' +
      'chancellor = e\n' +
      'castlingKingsideFile = i\n' +
      'castlingQueensideFile = c\n' +
      'startFen = rnbhqkebnr/pppppppppp/10/10/10/10/10/10/PPPPPPPPPP/RNBHAKEBNR w KQkq - 0 1\n' +
      'promotionRank = 10\n' +
      'promotionPieceTypes = aqehrbn\n' +
      'doubleStepRank = 2\n' },
    { name: 'Berserk queens (8x8)', ini:
      '# Rooks move like kings too (dragon kings), bishops too (dragon horses),\n' +
      '# and pawns promote on the seventh rank already.\n' +
      '# glyphs: d=R+K h=B+K\n' +
      '[berserk:chess]\n' +
      'customPiece1 = d:RF\n' +
      'customPiece2 = h:BW\n' +
      'startFen = dnhqkhnd/pppppppp/8/8/8/8/PPPPPPPP/DNHQKHND w - - 0 1\n' +
      'promotionRank = 7\n' +
      'promotionPieceTypes = qdhn\n' }
  ];

  function byId(id) {
    for (var i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].id === id) return VARIANTS[i];
    return VARIANTS[0];
  }

  /* ---------- FEN and move helpers ---------- */

  /* Split a FEN into raw cell tokens (letters, plus the ~ and + markers some
     variants use), the pocket if there is one, and the remaining fields. */
  function splitFen(fen) {
    var f = String(fen).split(' '), b = f[0], br = b.indexOf('['), pocket = null;
    if (br >= 0) { pocket = b.slice(br + 1, b.lastIndexOf(']')); b = b.slice(0, br); }
    var rows = b.split('/'), W = 0, grid = [];
    rows.forEach(function (row) {
      var line = [], num = '', pre = '';
      function flush() { if (num) { for (var k = 0; k < +num; k++) line.push(''); num = ''; } }
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '0' && ch <= '9') { num += ch; continue; }
        flush();
        if (ch === '+') pre = '+';
        else if (ch === '~') { if (line.length) line[line.length - 1] += '~'; }
        else if (/[A-Za-z]/.test(ch) || ch.charCodeAt(0) > 127) { line.push(pre + ch); pre = ''; } // the app's own fairy letters too
      }
      flush();
      W = Math.max(W, line.length);
      grid.push(line);
    });
    var cells = [];
    grid.forEach(function (line) { for (var x = 0; x < W; x++) cells.push(line[x] || ''); });
    return { cells: cells, W: W, H: grid.length, pocket: pocket, fields: f.slice(1) };
  }
  function joinFen(cells, W, H, pocket, fields) {
    var out = '';
    for (var r = 0; r < H; r++) {
      var empty = 0;
      for (var x = 0; x < W; x++) {
        var t = cells[r * W + x];
        if (!t) empty++;
        else { if (empty) { out += empty; empty = 0; } out += t; }
      }
      if (empty) out += empty;
      if (r < H - 1) out += '/';
    }
    if (pocket != null) out += '[' + pocket + ']';
    return out + ' ' + fields.join(' ');
  }
  function bare(tok) { return tok ? tok.replace(/[~+]/g, '') : ''; }
  function parseBoard(fen) {
    var p = splitFen(fen);
    return { board: p.cells.map(bare), W: p.W, H: p.H };
  }
  function sqIndex(name, W, H) { return (H - parseInt(name.slice(1), 10)) * W + FILES.indexOf(name[0]); }
  function sqName(i, W, H) { return FILES[i % W] + (H - Math.floor(i / W)); }

  function parseMove(uci, W, H, board, turn) {
    var d = /^([A-Za-z])@([a-l]\d{1,2})$/.exec(uci);
    if (d) {
      return { uci: uci, from: -1, to: sqIndex(d[2], W, H), drop: d[1].toLowerCase(), cap: '', promo: '',
        piece: turn === 'w' ? d[1].toUpperCase() : d[1].toLowerCase() };
    }
    var m = /^([a-l]\d{1,2})([a-l]\d{1,2})(.*)$/.exec(uci);
    if (!m) return null;
    var from = sqIndex(m[1], W, H), to = sqIndex(m[2], W, H), target = board[to];
    var enemy = target && ((target === target.toUpperCase()) !== (turn === 'w'));
    return { uci: uci, from: from, to: to, promo: m[3] || '', piece: board[from], cap: enemy ? target : '' };
  }

  // Random Chess960 back rank: bishops on opposite colors, king between the rooks.
  function random960() {
    var row = new Array(8).fill('');
    function empty() { var out = []; for (var i = 0; i < 8; i++) if (!row[i]) out.push(i); return out; }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    row[pick([0, 2, 4, 6])] = 'b';
    row[pick([1, 3, 5, 7])] = 'b';
    row[pick(empty())] = 'q';
    row[pick(empty())] = 'n';
    row[pick(empty())] = 'n';
    var rest = empty();
    row[rest[0]] = 'r'; row[rest[1]] = 'k'; row[rest[2]] = 'r';
    var back = row.join('');
    return back + '/pppppppp/8/8/8/8/PPPPPPPP/' + back.toUpperCase() + ' w KQkq - 0 1';
  }

  /* ---------- rules library ---------- */

  var ff = null, ffPromise = null, messages = [];
  function rules() {
    if (!ffPromise) {
      var collect = function (t) { messages.push(String(t)); };
      ffPromise = import(new URL('fairy/ffish.js', document.baseURI).href)
        .then(function (mod) { return mod.default({ locateFile: function (f) { return 'fairy/' + f; }, print: collect, printErr: collect }); })
        .then(function (m) {
          ff = m;
          var b = new ff.Board('chess'); // the first board initialises the variant tables
          b.delete();
          return ff;
        });
    }
    return ffPromise;
  }

  /* ---------- custom variants ---------- */

  var customCount = 0;
  // The fairy pictures a glyph line may name (letter=amazon), with the usual piece each stands in for.
  var ROLE_BASE = { amazon: 'Q', archbishop: 'B', chancellor: 'R', centaur: 'N', commoner: 'K', guard: 'K', nightrider: 'N', ferz: 'Q', wazir: 'R', elephant: 'B',
    dabbaba: 'R', camel: 'N', zebra: 'N', giraffe: 'N', unicorn: 'N', wizard: 'N', champion: 'R', dragon: 'N' };
  function parseGlyphs(ini) {
    var out = {}, m = /^[#;]\s*glyphs?\s*:\s*(.+)$/im.exec(ini);
    if (!m) return out;
    m[1].replace(/([A-Za-z])\s*=\s*([A-Za-z]+)(?:\s*\+\s*([A-Za-z]))?/g, function (all, l, a, b) {
      if (a.length > 1) { var role = a.toLowerCase(); if (ROLE_BASE[role]) out[l.toLowerCase()] = [ROLE_BASE[role], '', role]; }
      else out[l.toLowerCase()] = b ? [a.toUpperCase(), b.toUpperCase()] : [a.toUpperCase()];
      return all;
    });
    return out;
  }
  /* Load a variants.ini text. Section names get a unique suffix so an edited
     definition never collides with an older one. Resolves with the playable
     variant (the last section) or rejects with a readable error. */
  function loadCustom(ini) {
    return rules().then(function () {
      var names = [], re = /^\s*\[([^\]:\s]+)\s*(?::\s*([^\]\s]+))?\s*\]/gm, m;
      while ((m = re.exec(ini))) names.push(m[1]);
      if (!names.length) throw new Error('No variant found. A definition starts with a line like [myvariant:chess].');
      var tag = '_' + (++customCount);
      var text = ini.replace(/^(\s*)\[([^\]:\s]+)\s*(?::\s*([^\]\s]+))?\s*\]/gm, function (all, lead, name, parent) {
        var p = parent ? (names.indexOf(parent) >= 0 ? parent + tag : parent) : '';
        return lead + '[' + name + tag + (p ? ':' + p : '') + ']';
      });
      var uci = names[names.length - 1] + tag;
      messages.length = 0;
      ff.loadVariantConfig(text);
      var known = (' ' + ff.variants() + ' ').indexOf(' ' + uci + ' ') >= 0, fen = known ? ff.startingFen(uci) : '';
      if (!known || !fen) {
        var why = messages.filter(function (l) { return l.trim(); }).slice(0, 3).join(' ');
        throw new Error(why || 'Fairy-Stockfish rejected this definition.');
      }
      var b = new ff.Board(uci), moves = b.legalMoves();
      b.delete();
      if (!moves) throw new Error('The starting position has no legal moves.');
      var dims = parseBoard(fen);
      if (dims.W > 12 || dims.H > 10) throw new Error('Boards can be at most 12 files by 10 ranks.');
      return { uci: uci, title: names[names.length - 1], fen: fen, ini: text, source: ini, glyphs: parseGlyphs(ini),
        warnings: messages.filter(function (l) { return l.trim(); }).slice(0, 3) };
    });
  }

  /* ---------- game backend: variant rules plus the power-up layer ----------
     ffish stays the referee for the variant itself. Power-ups are board edits on
     top of it: every power move is turned into a new FEN and checked with ffish
     (own king safe, gold statues untouched). Fairy-Stockfish never learns about
     them, it only gets the list of moves that are still legal.
     Each side can have its own set: o.cfg.pw = { w: {...}, b: {...} }. The older flat
     form (flags on cfg, owned by cfg.side) still works.
     o = { uci, c960, startFen, cfg, hand, special, nocheck, boom, keepCastle } */
  var P_KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var P_KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var P_DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var P_ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var P_KEYS = ['double', 'sniper', 'midas', 'freeze', 'dragon', 'amazon', 'rocket', 'explosive', 'drops', 'portals', 'immortal', 'storm',
    'timestop', 'rampage', 'bodyguard', 'earlypromo', 'ghost', 'archer', 'iron', 'swap', 'turncoat',
    'sniperP', 'sniperR', 'sniperQ', 'sniperK', 'ghostB', 'ghostQ', 'sniperAll'];
  function anyPower(p) { if (!p) return false; for (var i = 0; i < P_KEYS.length; i++) if (p[P_KEYS[i]]) return true; return false; }

  function backend(ffm, o) {
    var cfg = o.cfg, NONE = {};
    // the power-ups of each colour, null for a side without any
    var PW = { w: null, b: null };
    if (cfg.pw) { PW.w = anyPower(cfg.pw.w) ? cfg.pw.w : null; PW.b = anyPower(cfg.pw.b) ? cfg.pw.b : null; }
    else if ((cfg.side === 'w' || cfg.side === 'b') && anyPower(cfg)) PW[cfg.side] = cfg;
    function pwOf(c) { return PW[c] || NONE; }
    var first = cfg.side === 'b' ? 'b' : 'w'; // whose Reinforcements sit in `pocket`, the other side uses `pocket2`
    function pocketKey(c) { return c === first ? 'pocket' : 'pocket2'; }
    var tmp = o.c960 ? new ffm.Board(o.uci, o.startFen, true) : new ffm.Board(o.uci, o.startFen);
    /* The scratch board is asked about the same position many times in a row. Setting it up is the
       dearest call there is, so it is only done when the position really changes. Every push has to
       clear atFen (or take the move back), otherwise the next posTo() would trust a board that moved on. */
    var atFen = null;
    /* Gold statues give no check, but Fairy-Stockfish knows nothing about them. So the board it is shown has
       every statue in the colour of the side to move: a statue then blocks as before and threatens nobody
       whose turn it is. Statues never move and are never taken, so nothing else changes; the statues' moves
       that this creates are thrown out like any statue move. gold = the statue squares of that position. */
    function posTo(fen, gold) {
      if (gold && gold.length) fen = statuesToMover(fen, gold);
      if (atFen !== fen) { tmp.setFen(fen); atFen = fen; }
    }
    function statuesToMover(fen, gold) {
      var p = splitFen(fen), side = p.fields[0] === 'b' ? 'b' : 'w';
      for (var i = 0; i < gold.length; i++) { var t = p.cells[gold[i]]; if (t) p.cells[gold[i]] = side === 'w' ? t.toUpperCase() : t.toLowerCase(); }
      return joinFen(p.cells, W, H, p.pocket, p.fields);
    }
    // the statues back in their own colours, after Fairy-Stockfish has played a move on a board that had them recoloured
    function statuesBack(fen, gold, raw) {
      if (!gold || !gold.length) return fen;
      var p = splitFen(fen);
      for (var i = 0; i < gold.length; i++) if (p.cells[gold[i]] && raw[gold[i]]) p.cells[gold[i]] = raw[gold[i]];
      return joinFen(p.cells, W, H, p.pocket, p.fields);
    }
    var same = function (a, b) { return (a || '').toLowerCase() === (b || '').toLowerCase(); }; // a statue may come back recoloured
    /* Frozen pieces give no check either: a frozen piece cannot move on its next turn. The other side's frozen
       pieces are shown in the mover's colour too when the mover's king safety is in question. They can still be
       taken, so the moves come from both boards (see baseMoves), and each move is played on the board it came from. */
    function foeIce(s) { return s.ice.filter(function (q) { return s.raw[q] && colorTok(s.raw[q]) !== s.turn; }); }
    function inert(s) { var f = foeIce(s); return f.length ? s.gold.concat(f) : s.gold; }
    function boardFor(s, m) { return m && m.inert ? inert(s) : s.gold; }
    var d0 = splitFen(o.startFen), W = d0.W, H = d0.H;
    var powers = !!(PW.w || PW.b);
    var checks = !o.nocheck;
    var plain = d0.fields.length < 5;                    // a FEN without castling and en passant fields
    var canQueen = H >= 8 && /q/i.test(o.startFen.split(' ')[0]); // Fast Promotion needs queens in the game

    function low(tok) { return bare(tok).toLowerCase(); }
    function whiteTok(tok) { var l = bare(tok); return l === l.toUpperCase(); }
    function colorTok(tok) { return whiteTok(tok) ? 'w' : 'b'; }
    function other(c) { return c === 'w' ? 'b' : 'w'; }
    function inside(r, f) { return r >= 0 && r < H && f >= 0 && f < W; }
    function name(sq) { return sqName(sq, W, H); }
    function withTurn(fen, c) { var f = fen.split(' '); f[1] = c; if (!plain && f.length > 3) f[3] = '-'; return f.join(' '); }
    function near(a, b) { return a >= 0 && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= 1 && Math.abs((a % W) - (b % W)) <= 1; }
    function letter(c, l) { return c === 'w' ? l.toUpperCase() : l; }
    function ownsDrops(c) { return !!pwOf(c).drops && !o.hand; } // Reinforcements, unless the variant has pockets of its own

    function cleanCastling(cells, str) {
      if (!str || str === '-') return '-';
      var out = '';
      for (var i = 0; i < str.length; i++) {
        var ch = str[i], white = ch === ch.toUpperCase(), row = white ? H - 1 : 0, kingF = -1, f, t;
        for (f = 0; f < W; f++) { t = cells[row * W + f]; if (t && low(t) === 'k' && whiteTok(t) === white) kingF = f; }
        if (kingF < 0) continue;
        var rook = white ? 'R' : 'r', ok = false, l = ch.toLowerCase();
        if (l === 'k') { for (f = kingF + 1; f < W; f++) if (cells[row * W + f] === rook) ok = true; }
        else if (l === 'q') { for (f = 0; f < kingF; f++) if (cells[row * W + f] === rook) ok = true; }
        else { f = FILES.indexOf(l); ok = f >= 0 && f < W && cells[row * W + f] === rook; }
        if (ok) out += ch;
      }
      return out || '-';
    }

    // Upgrades that attack in ways the variant's own rules do not know about.
    function reaches(ap) { return !!(ap.dragon || ap.amazon || ap.ghost || ap.ghostB || ap.ghostQ); }
    // Is the king of `victim` attacked by one of the other side's upgraded pieces? Returns its square or -1.
    function powerAttack(letters, victim, gold) {
      var by = other(victim), ap = pwOf(by);
      if (!checks || !reaches(ap)) return -1;
      if (gold && gold.length) { letters = letters.slice(); for (var gi = 0; gi < gold.length; gi++) if (letters[gold[gi]]) letters[gold[gi]] = '#'; } // a statue only blocks
      var king = letter(victim, 'k'), knight = letter(by, 'n'), queen = letter(by, 'q'), rook = letter(by, 'r'), bishop = letter(by, 'b'), byWhite = by === 'w';
      var diagGhost = ap.ghostB || ap.ghostQ, orthGhost = ap.ghost || ap.ghostQ;
      for (var sq = 0; sq < letters.length; sq++) {
        if (letters[sq] !== king) continue;
        var r = Math.floor(sq / W), f = sq % W, i, rr, ff2, g, thru;
        if (ap.dragon || diagGhost) for (i = 0; i < 4; i++) {
          rr = r + P_DIAG[i][0]; ff2 = f + P_DIAG[i][1]; thru = false;
          while (inside(rr, ff2)) {
            g = letters[rr * W + ff2];
            if (g) {
              if (g === knight && ap.dragon && !thru) return sq;
              // a ghost reaches the king through its own pieces
              if (thru && ((g === bishop && ap.ghostB) || (g === queen && ap.ghostQ))) return sq;
              if (diagGhost && (g === g.toUpperCase()) === byWhite) thru = true; else break;
            }
            rr += P_DIAG[i][0]; ff2 += P_DIAG[i][1];
          }
        }
        if (ap.amazon) for (i = 0; i < 8; i++) {
          rr = r + P_KN[i][0]; ff2 = f + P_KN[i][1];
          if (inside(rr, ff2) && letters[rr * W + ff2] === queen) return sq;
        }
        if (orthGhost) for (i = 0; i < 4; i++) {
          rr = r + P_ORTH[i][0]; ff2 = f + P_ORTH[i][1]; thru = false;
          while (inside(rr, ff2)) {
            g = letters[rr * W + ff2];
            if (g) {
              if (thru && ((g === rook && ap.ghost) || (g === queen && ap.ghostQ))) return sq;
              if ((g === g.toUpperCase()) === byWhite) thru = true; else break;
            }
            rr += P_ORTH[i][0]; ff2 += P_ORTH[i][1];
          }
        }
      }
      return -1;
    }

    function snap(fen, ov) {
      var p = splitFen(fen), side = p.fields[0] === 'b' ? 'b' : 'w';
      var still = ov.ice.length ? ov.gold.concat(ov.ice.filter(function (q) { return p.cells[q] && colorTok(p.cells[q]) !== side; })) : ov.gold;
      posTo(fen, still);
      var chk = tmp.checkedPieces(), turn = tmp.turn() ? 'w' : 'b';
      var pocket = function (white) { return tmp.pocket(white).toLowerCase().split('').filter(function (c) { return /[a-z]/.test(c); }); };
      var s = {
        fen: fen, raw: p.cells, board: p.cells.map(bare), turn: turn,
        pockets: { w: pocket(true), b: pocket(false) },
        check: chk ? chk.trim().split(/\s+/).filter(Boolean).map(function (n) { return sqIndex(n, W, H); }) : [],
        gold: ov.gold, ice: ov.ice, frozen: ov.ice.length ? ov.ice[0] : -1, freezeUsed: ov.freezeUsed, portals: ov.portals,
        pocket: ov.pocket, pocket2: ov.pocket2,
        movesLeft: ov.movesLeft, midasUsed: ov.midasUsed, stopUsed: ov.stopUsed || '', turned: ov.turned || '', fx: null
      };
      var pa = powerAttack(s.board, turn, still);
      if (pa >= 0 && s.check.indexOf(pa) < 0) s.check.push(pa);
      return s;
    }
    function overlay(s) {
      return { gold: s.gold, ice: s.ice, freezeUsed: s.freezeUsed, portals: s.portals, pocket: s.pocket, pocket2: s.pocket2, movesLeft: s.movesLeft, midasUsed: s.midasUsed, stopUsed: s.stopUsed, turned: s.turned };
    }
    function initial() {
      var s = snap(o.startFen, { gold: [], ice: [], freezeUsed: false, portals: [], pocket: [], pocket2: [], movesLeft: 0, midasUsed: 0, stopUsed: '', turned: '' });
      s.movesLeft = PW[s.turn] ? (PW[s.turn].double || 1) : 0;
      return s;
    }

    // Where the piece stands that a capture removes. En passant takes a pawn next to the target square.
    function victimSq(s, m) {
      if (m.drop || m.kind || s.board[m.to]) return m.to;
      var p = s.board[m.from];
      if (!p || p.toLowerCase() !== 'p' || (m.from % W) === (m.to % W)) return m.to;
      var side = Math.floor(m.from / W) * W + (m.to % W), v = s.board[side];
      return v && v.toLowerCase() === 'p' && colorTok(v) !== colorTok(p) ? side : m.to;
    }
    // Gold statues must still stand where they were, and so must the mover's own frozen pieces.
    function intact(s, cells, mover) {
      var i;
      for (i = 0; i < s.gold.length; i++) if (!same(cells[s.gold[i]], s.raw[s.gold[i]])) return false;
      for (i = 0; i < s.ice.length; i++) {
        var q = s.ice[i];
        if (s.raw[q] && colorTok(s.raw[q]) === mover && cells[q] !== s.raw[q]) return false;
      }
      return true;
    }
    // May a piece of the side to move take what stands on sq, given the other side's power-ups?
    function takeable(s, sq, fp, foeKing, byPawn) {
      var t = s.board[sq].toLowerCase();
      if (t === 'k' || s.gold.indexOf(sq) >= 0) return false;
      if (fp.immortal && t === 'q') return false;
      if (fp.iron && t === 'p' && !byPawn) return false;
      if (foeKing >= 0 && near(foeKing, sq)) return false;
      return true;
    }

    /* Work out what a move leads to. Returns null when it is not allowed: own king
       left in check, or a gold statue or a frozen piece would be touched. */
    function resolve(s, m) {
      var mover = s.turn, foe = other(mover), pw = pwOf(mover), fp = pwOf(foe), cells, fields, pocket, removed = [], edits = [], capSq = -1, moved = -1;
      var booms = [], tp = -1, edited = false, baseCheck = false, capture = false, fen1 = '';
      if (!m.kind) {
        var shown = boardFor(s, m);
        posTo(s.fen, shown);
        capture = tmp.isCapture(m.uci);
        tmp.push(m.uci);
        atFen = tmp.fen();
        fen1 = statuesBack(atFen, shown, s.raw);
        var p1 = splitFen(fen1);
        if (s.gold.length) posTo(fen1, s.gold); // the check after the move, with the statues now in the other side's colour
        baseCheck = tmp.isCheck();
        cells = p1.cells; fields = p1.fields; pocket = p1.pocket;
        var count = {}, i;
        for (i = 0; i < s.raw.length; i++) {
          var t0 = s.raw[i];
          if (t0 && colorTok(t0) !== mover) count[t0] = (count[t0] || 0) + 1;
          if (t0 && !cells[i] && i !== m.from && o.boom && capture) booms.push(i);
        }
        for (i = 0; i < cells.length; i++) if (cells[i] && count[cells[i]]) count[cells[i]]--;
        Object.keys(count).forEach(function (t) { for (var k = 0; k < count[t]; k++) removed.push(t); });
        if (capture) { capSq = victimSq(s, m); if (o.boom) booms.push(m.to); }
        var castle = !m.drop && low(s.raw[m.from]) === 'k' && (Math.abs((m.from % W) - (m.to % W)) > 1 || (s.raw[m.to] && colorTok(s.raw[m.to]) === mover));
        if (!m.drop && !castle && cells[m.to] && colorTok(cells[m.to]) === mover) moved = m.to;
      } else {
        var p0 = splitFen(s.fen);
        cells = p0.cells; fields = p0.fields; pocket = p0.pocket;
        fields[0] = foe;
        if (!plain && fields.length > 2) fields[2] = '-';
        edited = true;
        if (m.kind === 'snipe') { edits.push(cells[m.to]); cells[m.to] = ''; capSq = m.to; capture = true; }
        else if (m.kind === 'fly') {
          if (cells[m.to]) { edits.push(cells[m.to]); capSq = m.to; capture = true; }
          cells[m.to] = cells[m.from]; cells[m.from] = ''; moved = m.to;
        } else if (m.kind === 'rocket') {
          cells[m.to] = m.promo ? letter(mover, m.promo) : cells[m.from];
          cells[m.from] = ''; moved = m.to;
        } else if (m.kind === 'drop') cells[m.to] = m.piece;
        else if (m.kind === 'swap') {
          var kt = cells[m.from]; cells[m.from] = cells[m.to]; cells[m.to] = kt;
          // a king that swapped has moved: its castling rights are gone
          if (!plain && fields.length > 1) fields[1] = fields[1].split('').filter(function (ch) { return ch === '-' || (ch === ch.toUpperCase()) !== (mover === 'w'); }).join('') || '-';
        }
        else if (m.kind === 'storm') {
          // every pawn with room steps forward, front ranks first, nobody onto the last rank
          var pawn = letter(mover, 'p'), step = mover === 'w' ? -W : W, order = [], q, did = false;
          for (q = 0; q < cells.length; q++) if (bare(cells[q]) === pawn && s.gold.indexOf(q) < 0 && s.ice.indexOf(q) < 0) order.push(q);
          if (mover === 'b') order.reverse();
          order.forEach(function (from) {
            var t2 = from + step, row = Math.floor(t2 / W);
            if (t2 >= 0 && t2 < cells.length && !cells[t2] && row !== 0 && row !== H - 1) { cells[t2] = cells[from]; cells[from] = ''; did = true; }
          });
          if (!did) return null;
        }
      }
      if (pw.explosive && capSq >= 0) {
        var cr = Math.floor(capSq / W), cf = capSq % W, guard = fp.bodyguard ? s.board.indexOf(letter(foe, 'k')) : -1;
        for (var k2 = 0; k2 < 8; k2++) {
          var rr = cr + P_KG[k2][0], f2 = cf + P_KG[k2][1];
          if (!inside(rr, f2)) continue;
          var a = rr * W + f2, at = cells[a];
          if (!at || colorTok(at) === mover || low(at) === 'k' || s.gold.indexOf(a) >= 0) continue;
          if ((fp.immortal && low(at) === 'q') || (fp.iron && low(at) === 'p') || near(guard, a)) continue; // the other side's protection holds
          edits.push(at); cells[a] = ''; booms.push(a); edited = true;
        }
        if (booms.indexOf(capSq) < 0) booms.push(capSq);
      }
      // Fast Promotion: a pawn that gets two ranks short of the end becomes a queen.
      var early = false;
      if (pw.earlypromo && canQueen && moved >= 0 && low(cells[moved]) === 'p') {
        var prow = Math.floor(moved / W);
        if (mover === 'w' ? prow <= 2 : prow >= H - 3) { cells[moved] = letter(mover, 'q'); edited = true; early = true; }
      }
      if (pw.portals && s.portals.length === 2 && moved >= 0) {
        var exit = moved === s.portals[0] ? s.portals[1] : (moved === s.portals[1] ? s.portals[0] : -1);
        if (exit >= 0 && exit !== m.from && !cells[exit]) {
          var er = Math.floor(exit / W);
          if (!(low(cells[moved]) === 'p' && (er === 0 || er === H - 1))) {
            cells[exit] = cells[moved]; cells[moved] = ''; tp = exit; edited = true;
            if (!plain && fields.length > 2) fields[2] = '-';
          }
        }
      }
      if (!intact(s, cells, mover)) return null;
      var fen;
      if (edited) {
        if (pocket != null && o.hand) edits.forEach(function (t) {
          var l = t.indexOf('~') >= 0 ? 'p' : low(t);
          pocket += mover === 'w' ? l.toUpperCase() : l;
        });
        if (!plain && !o.keepCastle && fields.length > 1) fields[1] = cleanCastling(cells, fields[1]);
        fen = joinFen(cells, W, H, pocket, fields);
        if (checks) { posTo(withTurn(fen, mover), inert(s)); if (tmp.isCheck()) return null; }
        posTo(fen, s.gold);
        var nowCheck = tmp.isCheck();
        if (o.uci === 'racingkings' && nowCheck) return null;
        if (nowCheck && !baseCheck) {
          // Three-check: a check given by a power-up counts too.
          for (var ci = 0; ci < fields.length; ci++) {
            var cm = /^(\d+)\+(\d+)$/.exec(fields[ci]);
            if (cm) {
              fields[ci] = mover === 'w' ? Math.max(0, +cm[1] - 1) + '+' + cm[2] : cm[1] + '+' + Math.max(0, +cm[2] - 1);
              fen = joinFen(cells, W, H, pocket, fields);
            }
          }
        }
      } else fen = fen1;
      /* The 50 move count. Power moves are built from the old FEN, so they count here: a capture, a rocket or a
         pawn storm starts it again, anything else adds one. A pawn that can never go back and can promote
         starts it again with every move, also sideways (Fairy-Stockfish counts only its forward steps). */
      var ff = fen.split(' '), hf = ff.length - 2;
      if (hf >= 1 && /^\d+$/.test(ff[hf]) && /^\d+$/.test(ff[hf + 1])) {
        var pawnMove = !m.kind && !m.drop && low(s.raw[m.from]) === 'p' && o.uci !== 'pawnback';
        if (m.kind) {
          var old = s.fen.split(' ');
          ff[hf] = capture || m.kind === 'rocket' || m.kind === 'storm' ? '0' : String((parseInt(old[old.length - 2], 10) || 0) + 1);
          ff[hf + 1] = String((parseInt(old[old.length - 1], 10) || 1) + (mover === 'b' ? 1 : 0));
        } else if (pawnMove) ff[hf] = '0';
        fen = ff.join(' ');
      }
      // the mover's king must not end up under one of the other side's upgraded pieces either
      if (powerAttack(cells.map(bare), mover, inert(s)) >= 0) return null;
      return { fen: fen, removed: removed.concat(edits).map(bare), tp: tp, boom: booms.length > 0, booms: booms, capture: capture, early: early, cells: cells };
    }

    function baseMoves(s) {
      posTo(s.fen, s.gold);
      var str = tmp.legalMoves(), out = str ? str.split(' ').map(function (u) { return parseMove(u, W, H, s.board, s.turn); }).filter(Boolean) : [];
      var f = foeIce(s);
      if (!f.length || !checks) return out;
      // the moves that are legal only because the other side's frozen pieces give no check
      var seen = {};
      out.forEach(function (m) { seen[m.uci] = true; });
      posTo(s.fen, inert(s));
      var str2 = tmp.legalMoves();
      (str2 ? str2.split(' ') : []).forEach(function (u) {
        if (seen[u]) return;
        var m = parseMove(u, W, H, s.board, s.turn);
        if (!m || (m.from >= 0 && f.indexOf(m.from) >= 0)) return; // a frozen piece shown in the mover's colour is not the mover's
        m.inert = true;
        out.push(m);
      });
      return out;
    }

    // Extra moves the power-ups give the side to move. Pieces are recognised by their letter.
    function powerMoves(s, base) {
      var out = [], b = s.board, c = s.turn, foe = other(c), pw = pwOf(c), fp = pwOf(foe), has = {};
      var foeKing = fp.bodyguard ? b.indexOf(letter(foe, 'k')) : -1;
      base.forEach(function (m) { has[m.from + '>' + m.to] = true; });
      function target(sq) { return b[sq] && colorTok(b[sq]) !== c && takeable(s, sq, fp, foeKing, false); }
      function stuck(sq) { return s.gold.indexOf(sq) >= 0 || s.ice.indexOf(sq) >= 0; }
      function add(m) {
        var r = resolve(s, m);
        if (r) { m.after = r; out.push(m); }
      }
      for (var sq = 0; sq < b.length; sq++) {
        var p = b[sq];
        if (!p || colorTok(p) !== c || stuck(sq)) continue;
        var t = p.toLowerCase(), r = Math.floor(sq / W), f = sq % W, i, rr, f2, to;
        // A line from the piece: fn(to, passed) for every square it reaches. through = passes its own pieces.
        var walk = function (dirs, through, fn) {
          for (var d = 0; d < dirs.length; d++) {
            var wr = r + dirs[d][0], wf = f + dirs[d][1], passed = false;
            while (inside(wr, wf)) {
              var wt = wr * W + wf;
              if (!b[wt]) fn(wt, passed, false);
              else if (colorTok(b[wt]) === c) { if (!through) break; passed = true; }
              else { fn(wt, passed, true); break; }
              wr += dirs[d][0]; wf += dirs[d][1];
            }
          }
        };
        var shot = {};
        var shoot = function (to, byPawn) {
          if (shot[to]) return; // two power-ups can reach the same piece: one shot
          if (b[to] && colorTok(b[to]) !== c && takeable(s, to, fp, foeKing, !!byPawn)) { shot[to] = true; add({ kind: 'snipe', snipe: true, from: sq, to: to, piece: p, cap: b[to], promo: '' }); }
        };
        // Snipers for all pieces: every piece of the variant, whatever its letter, shoots what it could take
        if (pw.sniperAll) base.forEach(function (m) { if (m.from === sq && m.cap && b[m.to] && colorTok(b[m.to]) !== c) shoot(m.to, t === 'p'); });
        var fly = function (to) {
          if (has[sq + '>' + to]) return;
          if (!b[to]) add({ kind: 'fly', from: sq, to: to, piece: p, cap: '', promo: '' });
          else if (target(to)) add({ kind: 'fly', from: sq, to: to, piece: p, cap: b[to], promo: '' });
        };
        // Snipers shoot what they attack, by the usual movement of their letter. Ghosts pass through their own pieces.
        if (t === 'b') {
          if (pw.sniper) walk(P_DIAG, pw.ghostB, function (to, passed, enemy) { if (enemy) shoot(to); });
          if (pw.ghostB) walk(P_DIAG, true, function (to, passed) { if (passed) fly(to); });
        } else if (t === 'r') {
          if (pw.sniperR) walk(P_ORTH, pw.ghost, function (to, passed, enemy) { if (enemy) shoot(to); });
          if (pw.ghost) walk(P_ORTH, true, function (to, passed) { if (passed) fly(to); });
        } else if (t === 'q') {
          if (pw.sniperQ) walk(P_DIAG.concat(P_ORTH), pw.ghostQ, function (to, passed, enemy) { if (enemy) shoot(to); });
          if (pw.ghostQ) walk(P_DIAG.concat(P_ORTH), true, function (to, passed) { if (passed) fly(to); });
        } else if (t === 'n') {
          if (pw.dragon) walk(P_DIAG, false, function (to) { fly(to); });
          if (pw.archer) for (i = 0; i < 8; i++) {
            rr = r + P_KN[i][0]; f2 = f + P_KN[i][1];
            if (inside(rr, f2)) shoot(rr * W + f2);
          }
        } else if (t === 'k') {
          if (pw.sniperK) for (i = 0; i < 8; i++) {
            rr = r + P_KG[i][0]; f2 = f + P_KG[i][1];
            if (inside(rr, f2)) shoot(rr * W + f2);
          }
          if (pw.swap) {
            // Royal Swap: the king changes places with one of its rooks
            var rookL = letter(c, 'r');
            for (i = 0; i < b.length; i++) {
              if (b[i] === rookL && !stuck(i) && !has[sq + '>' + i]) add({ kind: 'swap', swap: true, from: sq, to: i, piece: p, cap: '', promo: '' });
            }
          }
        } else if (t === 'p' && pw.sniperP) {
          rr = r + (c === 'w' ? -1 : 1);
          if (inside(rr, f - 1)) shoot(rr * W + f - 1, true);
          if (inside(rr, f + 1)) shoot(rr * W + f + 1, true);
        }
        if (t === 'q' && pw.amazon) {
          for (i = 0; i < 8; i++) {
            rr = r + P_KN[i][0]; f2 = f + P_KN[i][1];
            if (!inside(rr, f2)) continue;
            to = rr * W + f2;
            if (has[sq + '>' + to]) continue;
            if (!b[to]) add({ kind: 'fly', from: sq, to: to, piece: p, cap: '', promo: '' });
            else if (target(to)) add({ kind: 'fly', from: sq, to: to, piece: p, cap: b[to], promo: '' });
          }
          if (pw.sniperQ) for (i = 0; i < 8; i++) {
            rr = r + P_KN[i][0]; f2 = f + P_KN[i][1];
            if (inside(rr, f2)) shoot(rr * W + f2);
          }
        }
        if (t === 'p' && pw.rocket) {
          var dir = c === 'w' ? -1 : 1, last = c === 'w' ? 0 : H - 1;
          for (rr = r + dir; rr >= 0 && rr < H && !b[rr * W + f]; rr += dir) {
            to = rr * W + f;
            if (has[sq + '>' + to]) continue;
            if (rr !== last) { add({ kind: 'rocket', from: sq, to: to, piece: p, cap: '', promo: '' }); continue; }
            // Landing on the last rank: ask the variant what a pawn may become there.
            var pre = (rr - dir) * W + f, cells = s.raw.slice();
            cells[pre] = cells[sq]; if (pre !== sq) cells[sq] = '';
            var pf = splitFen(s.fen);
            if (!plain && pf.fields.length > 2) pf.fields[2] = '-';
            posTo(joinFen(cells, W, H, pf.pocket, pf.fields), s.gold);
            var lead = name(pre) + name(to), str = tmp.legalMoves();
            (str ? str.split(' ') : []).forEach(function (u) {
              if (u.indexOf(lead) === 0 && u.length > lead.length) add({ kind: 'rocket', from: sq, to: to, piece: p, cap: '', promo: u.slice(lead.length) });
            });
          }
        }
      }
      if (pw.explosive) {
        /* Explosive Captures can make a capture legal that the variant forbids: the blast may remove the
           piece that defends the target or pins the capturer. The variant is asked again with the blast
           victims already gone, and resolve() then checks the real outcome. */
        var p0x = null;
        for (var T = 0; T < b.length; T++) {
          if (!b[T] || colorTok(b[T]) === c || !target(T)) continue;
          var tr = Math.floor(T / W), tf = T % W, gone = [];
          for (var k9 = 0; k9 < 8; k9++) {
            var br = tr + P_KG[k9][0], bf = tf + P_KG[k9][1];
            if (!inside(br, bf)) continue;
            var q9 = br * W + bf;
            if (b[q9] && colorTok(b[q9]) !== c && target(q9)) gone.push(q9);
          }
          if (!gone.length) continue;
          if (!p0x) p0x = splitFen(s.fen);
          var cells9 = p0x.cells.slice();
          gone.forEach(function (q) { cells9[q] = ''; });
          posTo(joinFen(cells9, W, H, p0x.pocket, p0x.fields), s.gold);
          var str9 = tmp.legalMoves(), dest = name(T);
          (str9 ? str9.split(' ') : []).forEach(function (u) {
            var pm = parseMove(u, W, H, b, c);
            if (!pm || pm.drop || pm.to !== T || pm.promo || has[pm.from + '>' + T] || stuck(pm.from)) return;
            // not a move through a square that only the blast would clear
            var dr = Math.sign(Math.floor(T / W) - Math.floor(pm.from / W)), df = Math.sign((T % W) - (pm.from % W));
            var lr = Math.abs(Math.floor(T / W) - Math.floor(pm.from / W)), lf = Math.abs((T % W) - (pm.from % W));
            if (lr === lf || lr === 0 || lf === 0) {
              for (var x = pm.from + dr * W + df; x !== T; x += dr * W + df) if (gone.indexOf(x) >= 0) return;
            }
            has[pm.from + '>' + T] = true;
            add({ kind: 'fly', from: pm.from, to: T, piece: b[pm.from], cap: b[T], promo: '' });
          });
        }
      }
      if (pw.storm) add({ kind: 'storm', storm: true, from: -1, to: -1, piece: letter(c, 'p'), cap: '', promo: '' });
      var pocket = ownsDrops(c) ? s[pocketKey(c)] : null;
      if (pocket && pocket.length) {
        posTo(s.fen, inert(s));
        var inChk = tmp.isCheck() || powerAttack(b, c, inert(s)) >= 0, seen = {};
        pocket.forEach(function (pt) {
          if (seen[pt]) return;
          seen[pt] = true;
          var piece = letter(c, pt);
          for (var e = 0; e < b.length; e++) {
            if (b[e]) continue;
            var er = Math.floor(e / W);
            if (pt === 'p' && (er === 0 || er === H - 1)) continue;
            var m = { kind: 'drop', from: -1, to: e, drop: pt, piece: piece, cap: '', promo: '' };
            if (inChk || o.uci === 'racingkings') add(m); else out.push(m); // a drop can only matter for king safety when in check
          }
        });
      }
      return out;
    }

    function legal(s) {
      var base = baseMoves(s);
      if (!powers && !s.gold.length && !s.ice.length) return base; // statues and ice bind even a side that knows no power-ups
      var me = s.turn, foe = other(me), pw = pwOf(me), fp = pwOf(foe);
      // 1. What the other side's power-ups, the statues and the ice forbid.
      var needAtk = checks && reaches(fp), queen = letter(foe, 'q'), foePawn = letter(foe, 'p');
      var foeKing = fp.bodyguard ? s.board.indexOf(letter(foe, 'k')) : -1, myIce = false, i;
      for (i = 0; i < s.ice.length; i++) if (s.raw[s.ice[i]] && colorTok(s.raw[s.ice[i]]) === me) myIce = true;
      if (s.gold.length || myIce || needAtk || fp.immortal || foeKing >= 0 || fp.iron) {
        var queens = function (list) { var n = 0; for (var k = 0; k < list.length; k++) if (bare(list[k]) === queen) n++; return n; };
        var q0 = queens(s.raw), myKing = letter(me, 'k');
        base = base.filter(function (m) {
          if (needAtk && !m.drop && s.board[m.from] === myKing && (Math.abs((m.from % W) - (m.to % W)) > 1 || (s.board[m.to] && colorTok(s.board[m.to]) === me))) {
            // castling: not out of, and not through, a check by one of the other side's upgraded pieces
            var lo = Math.min(m.from, m.to), hi = Math.max(m.from, m.to), probe = s.board.slice();
            probe[m.from] = '';
            for (var x = lo; x <= hi; x++) {
              if (probe[x] && x !== m.from) continue;
              var was = probe[x];
              probe[x] = myKing;
              var hitK = powerAttack(probe, me, inert(s)) >= 0;
              probe[x] = was;
              if (hitK) return false;
            }
          }
          if (!m.drop) {
            var hit = s.board[m.to];
            if (hit && colorTok(hit) === foe) {
              if (s.gold.indexOf(m.to) >= 0) return false;
              if (foeKing >= 0 && near(foeKing, m.to)) return false;                                     // Bodyguard
              if (fp.iron && hit === foePawn && s.board[m.from].toLowerCase() !== 'p') return false;      // Iron Pawns
            }
          }
          /* Most moves only change the square they leave and the one they reach. If neither is a statue
             or a frozen piece of the mover, nothing can be disturbed and the move need not be tried out.
             Pawns and kings take the long way (en passant, castling), and so does everything in a variant
             with explosions or when the position after the move has to be looked at anyway. */
          if (!o.boom && !needAtk && !fp.immortal) {
            if (m.drop) return true;
            var mp = s.board[m.from].toLowerCase();
            if (mp !== 'p' && mp !== 'k') return s.gold.indexOf(m.from) < 0 && s.gold.indexOf(m.to) < 0 && s.ice.indexOf(m.from) < 0;
          }
          var shown = boardFor(s, m);
          posTo(s.fen, shown);
          tmp.push(m.uci);
          var cells = splitFen(statuesBack(tmp.fen(), shown, s.raw)).cells;
          tmp.pop();
          if (!intact(s, cells, me)) return false;
          if (fp.immortal && queens(cells) < q0) return false; // Immortal Queen
          return !(needAtk && powerAttack(cells.map(bare), me, inert(s)) >= 0);
        });
      }
      if (!PW[me]) return base;
      // 2. What the mover's own power-ups change about normal moves, plus the extra moves they add.
      var out = [];
      base.forEach(function (m) {
        var cap = false;
        if (pw.explosive && !m.drop) { posTo(s.fen, boardFor(s, m)); cap = tmp.isCapture(m.uci); }
        var onPortal = pw.portals && s.portals.length === 2 && s.portals.indexOf(m.to) >= 0;
        var torow = Math.floor(m.to / W);
        var promotes = pw.earlypromo && canQueen && !m.drop && !m.promo && s.board[m.from] && s.board[m.from].toLowerCase() === 'p' && (me === 'w' ? torow <= 2 : torow >= H - 3);
        if ((cap && pw.explosive) || onPortal || promotes) {
          var r = resolve(s, m);
          if (!r) return;
          m.after = r;
        }
        out.push(m);
      });
      return out.concat(powerMoves(s, base));
    }

    function play(s, m) {
      var r = m.after || resolve(s, m), mover = s.turn, pw = pwOf(mover), ov = overlay(s);
      if (ownsDrops(mover)) {
        var pk = pocketKey(mover);
        ov[pk] = s[pk].concat(r.removed.map(function (l) { return l.toLowerCase(); }));
        if (m.kind === 'drop') ov[pk].splice(ov[pk].indexOf(m.drop), 1);
      }
      var cells = r.cells || splitFen(r.fen).cells;
      // Ice only holds the piece it was put on: a square that was captured on or vacated thaws.
      if (s.ice.length) ov.ice = s.ice.filter(function (q) { return cells[q] === s.raw[q]; });
      var fx = {
        removed: r.removed.map(function (l) { return { p: l }; }), tp: r.tp, boom: r.boom, booms: r.booms, capture: r.capture, early: r.early,
        anims: (m.drop || m.snipe || m.storm || m.swap) ? [] : [{ from: m.from, to: r.tp >= 0 ? r.tp : m.to }]
      };
      if (PW[mover]) {
        ov.movesLeft = s.movesLeft - 1 + (pw.rampage && r.capture ? 1 : 0); // Rampage: a capture earns another move
        if (ov.movesLeft > 0) {
          posTo(r.fen, s.gold);
          // A check ends the turn, and so does a win by the variant's own rule. Leaving the other side
          // without a move does not: the turn simply goes on.
          var inChk = tmp.isCheck(), done = tmp.isGameOver(false);
          if (done && !inChk && !o.special && !tmp.legalMoves()) done = false;
          var stop = inChk || done || powerAttack(cells.map(bare), other(mover), s.gold) >= 0;
          if (!stop) {
            var again = snap(withTurn(r.fen, mover), ov);
            if (legal(again).length) { again.fx = fx; return again; }
          }
          ov.movesLeft = 0;
        }
      }
      // the turn passes: the ice on the mover's own pieces melts
      if (ov.ice.length) ov.ice = ov.ice.filter(function (q) { return cells[q] && colorTok(cells[q]) !== mover; });
      var n = snap(r.fen, ov);
      if (PW[n.turn]) { n.movesLeft = PW[n.turn].double || 1; n.midasUsed = 0; n.freezeUsed = false; }
      else n.movesLeft = 0;
      n.fx = fx;
      return n;
    }

    function san(s, m, lg, n) {
      var out;
      if (!m.kind) {
        posTo(s.fen, boardFor(s, m));
        out = tmp.sanMove(m.uci);
        if (!powers) return out;
        out = out.replace(/[+#]$/, '');
      }
      else if (m.kind === 'snipe') out = bare(m.piece).toUpperCase() + '*' + name(m.to);
      else if (m.kind === 'drop') out = m.drop.toUpperCase() + '@' + name(m.to);
      else if (m.kind === 'storm') out = 'Storm';
      else if (m.kind === 'swap') out = 'K~' + name(m.to);
      else if (m.kind === 'rocket') out = name(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      else out = bare(m.piece).toUpperCase() + (m.cap ? 'x' : '') + name(m.to);
      if (n.fx.early) out += '=Q';
      if (n.fx.boom && !o.boom) out += '^';
      if (n.fx.tp >= 0) out += '>' + name(n.fx.tp);
      if (n.turn !== s.turn && n.check.length) out += '+';
      return out;
    }

    function verdict(s, res, none, inCheck) {
      var result = res === '1-0' ? 'w' : res === '0-1' ? 'b' : 'draw', reason;
      if (result === 'draw') reason = none ? 'stalemate' : 'drawrule';
      else if (/\s(0\+\d+|\d+\+0)\s/.test(s.fen)) reason = 'variant';
      else reason = none && inCheck && o.uci !== 'kingofthehill' && o.uci !== 'racingkings' ? 'checkmate' : 'variant';
      return { over: true, result: result, reason: reason };
    }
    function status(s, lg) {
      posTo(s.fen, inert(s)); // check without the statues and the other side's frozen pieces
      if (!powers) {
        if (!tmp.isGameOver(true)) return { over: false };
        return verdict(s, tmp.result(true), !tmp.legalMoves(), tmp.isCheck());
      }
      var over = tmp.isGameOver(false), none = !tmp.legalMoves(), inCheck = tmp.isCheck();
      if (over) {
        var res = tmp.result(false);
        var escape = !!PW[s.turn] && !o.special && none && lg.length > 0; // a power-up still offers a way out
        var bareDraw = !none && res === '1/2-1/2';                        // too little material, but power-ups can still decide it
        if (!escape && !bareDraw) return verdict(s, res, none, inCheck);
      }
      if (!lg.length) {
        var hit = inCheck || powerAttack(s.board, s.turn, inert(s)) >= 0;
        return hit ? { over: true, result: other(s.turn), reason: 'checkmate' } : { over: true, result: 'draw', reason: 'stalemate' };
      }
      var f = s.fen.split(' '), half = parseInt(f[f.length - 2], 10);
      if (half >= 100) return { over: true, result: 'draw', reason: 'the 50 move rule' };
      return { over: false };
    }

    /* The free actions, always for the side to move. */
    function gildTargets(s, lg) {
      var pw = pwOf(s.turn);
      if (!pw.midas) return [];
      if (pw.midasPerTurn > 0 && s.midasUsed >= pw.midasPerTurn) return [];
      var out = [];
      (lg || legal(s)).forEach(function (m) {
        if (m.drop || m.to < 0) return;
        var at = victimSq(s, m), t = s.board[at];
        if (t && colorTok(t) !== s.turn && t.toLowerCase() !== 'k' && s.gold.indexOf(at) < 0 && out.indexOf(at) < 0) out.push(at);
      });
      // in check, a gild that uses the turn only counts when the statue ends the check (statues give no check), as in rules.js
      if (pw.midasPerTurn === -1 && s.check.length) out = out.filter(function (at) {
        var still = inert(s).concat([at]);
        posTo(s.fen, still);
        return !tmp.isCheck() && powerAttack(s.board, s.turn, still) < 0;
      });
      return out;
    }
    function gild(s, sq) {
      if (gildTargets(s, legal(s)).indexOf(sq) < 0) return null;
      var ov = overlay(s);
      ov.gold = s.gold.concat([sq]);
      ov.midasUsed = s.midasUsed + 1;
      var f = s.fen.split(' ');
      f[f.length - 2] = '0'; // a statue can never come back, like a capture: the 50 move count starts again
      if (pwOf(s.turn).midasPerTurn !== -1) return snap(f.join(' '), ov);
      // Midas that uses the turn: the gild is one move of it; with Double Move moves left the same side goes on
      var mover = s.turn;
      ov.movesLeft = s.movesLeft - 1;
      if (ov.movesLeft > 0) { var same = snap(withTurn(f.join(' '), mover), ov); if (legal(same).length) return same; }
      ov.movesLeft = 0;
      if (mover === 'b') f[f.length - 1] = String((parseInt(f[f.length - 1], 10) || 1) + 1);
      if (ov.ice.length) ov.ice = ov.ice.filter(function (q) { return s.board[q] && colorTok(s.raw[q]) !== mover; });
      var n = snap(withTurn(f.join(' '), other(mover)), ov);
      if (PW[n.turn]) { n.movesLeft = PW[n.turn].double || 1; n.midasUsed = 0; n.freezeUsed = false; }
      else n.movesLeft = 0;
      return n;
    }
    function freezeTargets(s) {
      if (!pwOf(s.turn).freeze || s.freezeUsed) return [];
      var out = [];
      for (var i = 0; i < s.board.length; i++) {
        var t = s.board[i];
        if (t && colorTok(t) !== s.turn && t.toLowerCase() !== 'k' && s.gold.indexOf(i) < 0 && s.ice.indexOf(i) < 0) out.push(i);
      }
      return out;
    }
    function freeze(s, sq) {
      if (freezeTargets(s).indexOf(sq) < 0) return null;
      var ov = overlay(s);
      ov.ice = s.ice.concat([sq]);
      ov.freezeUsed = true;
      return snap(s.fen, ov);
    }
    // Turncoat: once per game an enemy piece changes sides. Never the king, and never into an instant check.
    function convertTargets(s) {
      var me = s.turn;
      if (!pwOf(me).turncoat || s.turned.indexOf(me) >= 0) return [];
      var out = [], foe = other(me), p0 = splitFen(s.fen);
      for (var i = 0; i < s.board.length; i++) {
        var t = s.raw[i];
        if (!t || colorTok(t) === me || low(t) === 'k' || s.gold.indexOf(i) >= 0) continue;
        var cells = p0.cells.slice();
        cells[i] = me === 'w' ? t.toUpperCase() : t.toLowerCase();
        if (checks) { posTo(withTurn(joinFen(cells, W, H, p0.pocket, p0.fields), foe), s.gold); if (tmp.isCheck()) continue; }
        if (powerAttack(cells.map(bare), foe, s.gold) >= 0) continue;
        out.push(i);
      }
      return out;
    }
    function convert(s, sq) {
      if (convertTargets(s).indexOf(sq) < 0) return null;
      var p0 = splitFen(s.fen), ov = overlay(s), me = s.turn;
      p0.cells[sq] = me === 'w' ? p0.cells[sq].toUpperCase() : p0.cells[sq].toLowerCase();
      if (!plain && !o.keepCastle && p0.fields.length > 1) p0.fields[1] = cleanCastling(p0.cells, p0.fields[1]);
      ov.turned = s.turned + me;
      ov.ice = s.ice.filter(function (q) { return q !== sq; });
      return snap(joinFen(p0.cells, W, H, p0.pocket, p0.fields), ov);
    }
    function stopReady(s) { return !!pwOf(s.turn).timestop && s.stopUsed.indexOf(s.turn) < 0; }
    function timeStop(s) {
      if (!stopReady(s)) return null;
      var ov = overlay(s);
      ov.movesLeft = s.movesLeft + 2;
      ov.stopUsed = s.stopUsed + s.turn;
      return snap(s.fen, ov);
    }
    function withPortals(s, a, b) {
      var ov = overlay(s);
      ov.portals = [a, b];
      return snap(s.fen, ov);
    }

    return {
      kind: 'fairy', W: W, H: H, powers: powers,
      initial: initial, legal: legal, play: play, san: san, status: status,
      checks: function (s) { return s.check; },
      gildTargets: gildTargets, gild: gild, freezeTargets: freezeTargets, freeze: freeze, withPortals: withPortals,
      stopReady: stopReady, timeStop: timeStop, convertTargets: convertTargets, convert: convert,
      has: function (c) { return !!PW[c]; }, powersOf: pwOf,
      uci: function (m) { return m.kind ? null : m.uci; },
      fen: function (s) { return s.fen; },
      key: function (s) {
        return s.fen.split(' ').slice(0, 4).join(' ') + '|' + s.gold.join(',') + '|' + s.ice.join(',') + '|' + s.pocket.slice().sort().join('') + '/' + s.pocket2.slice().sort().join('') + '|' + s.movesLeft + '|' + s.turned;
      },
      position: function (s) { return 'fen ' + s.fen; },
      // Moves the engine may choose from, or null when the variant's own rules are enough.
      searchmoves: function (s, lg, forHint) {
        if (!powers) return null;
        var list = [], fp = pwOf(other(s.turn));
        lg.forEach(function (m) { if (!m.kind && list.indexOf(m.uci) < 0) list.push(m.uci); });
        return forHint || s.gold.length || s.ice.length || reaches(fp) || fp.immortal || fp.bodyguard || fp.iron ? list : null;
      },
      find: function (lg, uci) { for (var i = 0; i < lg.length; i++) if (!lg[i].kind && lg[i].uci === uci) return lg[i]; return null; },
      dispose: function () { try { tmp.delete(); } catch (e) { /* already gone */ } }
    };
  }

  root.Fairy = {
    VARIANTS: VARIANTS, TEMPLATES: TEMPLATES, FILES: FILES, START: START, byId: byId,
    parseBoard: parseBoard, sqIndex: sqIndex, sqName: sqName, parseMove: parseMove, random960: random960,
    rules: rules, loadCustom: loadCustom, parseGlyphs: parseGlyphs, ROLE_BASE: ROLE_BASE, backend: backend, splitFen: splitFen,
    get ff() { return ff; }
  };
})(self);
