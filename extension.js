// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
var Promise = require('bluebird');
var request = Promise.promisify(require("request"));
var shell = require("shelljs");
var path = require('path');


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
    console.log("Initialising");
    var server = shell.exec(path.join(__dirname,"node_modules","instant-markdown-d","instant-markdown-d"), {async: true})
    server.stdout.on('data', function(data) {
      if (!started && (data.toString().indexOf("connection established!") !== -1 || data.toString().indexOf("EADDRINUSE") !== -1)) {
        callback();
        started = true;
      }

      console.log(">>>" + data);
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
        console.log(e)
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