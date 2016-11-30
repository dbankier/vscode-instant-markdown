// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
var Promise = require('bluebird');
var request = Promise.promisify(require("request"));
var path = require('path');
var open = require('open')



var spawn = require('child_process').spawn;
var shell = function(cmd,args,props) {
  if (process.platform === 'win32') {
    args = ['/c',cmd].concat(args);
    cmd = process.env.comspec;
  }
  return spawn(cmd,args,props);

}

function activate(context) {
  var instantMarkdown = new InstantMarkdown();
  var instantMarkdownController = new InstantMarkdownController(instantMarkdown);
	context.subscriptions.push(instantMarkdown);
  context.subscriptions.push(instantMarkdownController);
}

function InstantMarkdown() {
  var started = false;
  var self = this;
  this.initialise = function(callback) {
    var server = shell('node', [path.join(__dirname,"node_modules","instant-markdown-d","instant-markdown-d")])
    server.stdout.on('data', function(data) {
      console.log(">>>" + data.toString());
      if (!started && (data.toString().indexOf("connection established!") !== -1 )) {
        callback();
        started = true;
      }
    });
    server.stderr.on('data', function(data) {
      console.log(">>> " + data.toString())
      if (!started && (data.toString().indexOf("EADDRINUSE") !== -1)) {
        callback();
        started = true;
      }
    })
    server.on('exit', function(data) {
      console.log("!!> " + data.toString());
    });
  };
  this.update = function() {
    function requestUpdate() {
      return request({
        uri: "http://localhost:8090",
        method: "PUT",
        body: vscode.window.activeTextEditor.document.getText()
      })
      .then(function() {}, function(e) {
        if (e.code === "ECONNREFUSED") {
          self.initialise();
        }
      });
    }
    if (started) {
      requestUpdate();
    } else {
      this.initialise(requestUpdate);
    }
  };
  this.close = function() {
    if (started) {
      return request({
        uri: "http://localhost:8090",
        method: "DELETE"
      })
      .then(function() { started = false } , function(e) { started = false; });
    }
  }
}

function InstantMarkdownController(md) {
  var subscriptions = [];
  function update() {
    var editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    var doc = editor.document;
    if (doc.languageId === "markdown") {
      md.update();
    } else {
      md.close();
    }
  }
  vscode.window.onDidChangeActiveTextEditor(update, this, subscriptions);
  vscode.window.onDidChangeTextEditorSelection(update, this, subscriptions);
  md.update();
}
exports.activate = activate;