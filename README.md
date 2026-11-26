# Power Chess

Chess with power-ups, variants, fairy pieces and game modes, as an installable web app.
Open it on a phone, then use "Install" in the browser menu or in the app's Settings.

## Third-party parts

- Stockfish 19 (lite build), GPLv3: https://github.com/official-stockfish/Stockfish, see engine/LICENSE-stockfish.txt
- Fairy-Stockfish and ffish.js, GPLv3: https://github.com/fairy-stockfish/Fairy-Stockfish
- Puzzles from the Lichess puzzle database, CC0: https://database.lichess.org/#puzzles
- Piece sets from the Lichess project: https://github.com/lichess-org/lila/tree/master/public/piece

## Chess Scan (`scan/`)

A separate installable app in the `scan/` folder: photograph a chess board, the position is recognised on the phone,
and Stockfish shows the best move and the evaluation. Open `<site>/scan/` on the phone, then "Install app" / "Add to
Home screen" in the browser menu. After the first visit it works without a network: every file, the recognition
models and the engine are cached by `scan/sw.js`.

- Two modes: **Screen** (screenshots and photos of a chess app or website) and **Real board** (a physical set)
- Camera (or a photo from the gallery) → board corners found automatically, adjustable by dragging → pieces recognised
- Side to move and castling rights can be set; Edit fixes any square, turns the board, or sets up a position by hand
- Moves for either side on the board, Back/Forward, best move with up to five lines, live analysis, FEN in and out
- Recognition models: `scan/models/*.onnx`, MobileNetV3 based, run with ONNX Runtime Web (MIT):
  `corners` (board corners, real photos + synthetic screens), `pieces` (real sets, ChessReD + chesscog),
  `pieces2d` (digital boards, synthetic boards drawn with the Lichess piece sets). Training code in `scan/tools/train/`
- After changing a file of the app, run `python3 scan/tools/stamp_sw.py` so phones pick up the new version

Datasets used for training: ChessReD (Masouris & van Gemert, CC BY 4.0, https://data.4tu.nl/datasets/99b5c721-280b-450b-b058-b2900b69a90f),
chesscog rendered dataset (Wölflein & Arandjelović, CC BY 4.0, https://osf.io/xf3ka/).
