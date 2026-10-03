/* Worker shell for the power-up brain. */
importScripts('rules.js', 'brain.js', 'drawbacks.js', 'hex.js');
importScripts.apply(null, self.Drawbacks.PARTS.map(function (p) { return 'drawbacks/' + p + '.js'; })); // every drawback, for Drawback Chess
