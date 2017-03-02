// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import Server from './server'
const path = require('path');
const open = require('opn')
const hljs = require('highlight.js')
const MarkdownIt = require('markdown-it')
var taskLists = require('markdown-it-task-lists');

function activate(context) {
  var instantMarkdown = new InstantMarkdown();
  var instantMarkdownController = new InstantMarkdownController(instantMarkdown);
	context.subscriptions.push(instantMarkdown);
  context.subscriptions.push(instantMarkdownController);
}

function InstantMarkdown() {
  let started = false;
  let server;
  let self = this;
  this.initialise = function(callback) {
    if (!server) {
      server = new Server({
        started() {
          started = true;
          open("http://localhost:8090")
          setTimeout(() => self.pushMarkdown() , 1000)
        }
      });
    }
  };
  this.pushMarkdown = function() {
    let md = new MarkdownIt('default', {
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(lang, str).value;
          } catch (__) {}
        }
        return '';
      }
    });
    server.send(md.use(taskLists).render(vscode.window.activeTextEditor.document.getText()))
  }
  this.update = function() {
    if (started) {
      this.pushMarkdown();
    } else {
      this.initialise(this.pushMarkdown);
    }
  };
  this.close = function() {
    server.close()
    server = false;
    started = false;
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