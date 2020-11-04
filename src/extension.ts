// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Server from './server';

const path = require('path');
const open = require('opn');
const hljs = require('highlight.js');
const MarkdownIt = require('markdown-it');
const debounce = require('debounce');

function activate(context) {
  var instantMarkdown = new InstantMarkdown();
  var instantMarkdownController = new InstantMarkdownController(
    instantMarkdown
  );
  context.subscriptions.push(instantMarkdown);
  context.subscriptions.push(instantMarkdownController);
  context.subscriptions.push(
    vscode.commands.registerCommand('instantmarkdown.openBrowser', openBrowser)
  );
}

let last_instance;
function openBrowser() {
  var port = vscode.workspace.getConfiguration('instantmarkdown').get('port');
  var host = vscode.workspace.getConfiguration('instantmarkdown').get('host');
  open('http://' + host + ':' + port);
  if (last_instance) {
    setTimeout(() => last_instance.pushMarkdown(), 1000);
  }
}
function InstantMarkdown() {
  let started = false;
  let server;
  let self = (last_instance = this);
  this.initialise = function (callback) {
    if (!server) {
      server = new Server({
        root: path.dirname(vscode.window.activeTextEditor.document.fileName),
        started() {
          started = true;
          if (
            vscode.workspace
              .getConfiguration('instantmarkdown')
              .get('autoOpenBrowser')
          ) {
            openBrowser();
          }
        },
      });
    }
  };

  this.pushMarkdown = function (event, textInView) {
    const scrollEnabled = vscode.workspace
      .getConfiguration('instantmarkdown')
      .get('scroll');
    const cursorEnabled = vscode.workspace
      .getConfiguration('instantmarkdown')
      .get('cursor');

    let md = new MarkdownIt('default', {
      html: true,
      linkify: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(lang, str).value;
          } catch (__) {}
        }
        return '';
      },
    });

    var beforeText = vscode.window.activeTextEditor.document.getText();

    if (event === 'scroll' && scrollEnabled) {
      var position = beforeText.indexOf(textInView);

      var afterText =
        beforeText.substring(0, position) +
        '<span id="instant-markdown-cursor"></span>\n' +
        beforeText.substring(position, beforeText.length);
    } else if (event === 'cursor' && cursorEnabled) {
      for (var i = 0; i < beforeText.length; i++) {
        if (beforeText[i] !== textInView[i]) {
          var afterText =
            beforeText.substring(0, i) +
            '<span id="instant-markdown-cursor"></span>' +
            beforeText.substring(i, beforeText.length);
          break;
        }
      }
    } else {
      var afterText = beforeText;
    }

    var plantuml_options =
      vscode.workspace
        .getConfiguration('instantmarkdown')
        .get('plantUMLOptions')

    var new_markdown = md
      .use(require('markdown-it-task-lists'))
      .use(require('markdown-it-sup'))
      .use(require('markdown-it-named-headers'))
      .use(require('markdown-it-plantuml'), plantuml_options)
      .use(require('markdown-it-mathjax')())
      .use(require('markdown-it-mermaid').default)
      .render(afterText);

    server.send(new_markdown);
  };
  let last_debounce = vscode.workspace
    .getConfiguration('instantmarkdown')
    .get('debounce');
  this.update = function (event, textInView) {
    let debouncedPush = debounce(function () {
      self.pushMarkdown(event, textInView);
    }, last_debounce);
    //check if the config has changed
    let curr_debounce = vscode.workspace
      .getConfiguration('instantmarkdown')
      .get('debounce');
    if (curr_debounce !== last_debounce) {
      last_debounce = curr_debounce;
      debouncedPush = debounce(function () {
        self.pushMarkdown(event, textInView);
      }, last_debounce);
    }
    if (started) {
      debouncedPush();
    } else {
      this.initialise(this.pushMarkdown);
    }
  };
  this.close = function () {
    if (
      vscode.workspace
        .getConfiguration('instantmarkdown')
        .get('autoCloseServerAndBrowser')
    ) {
      server.close();
      server = false;
      started = false;
    }
  };
}

function InstantMarkdownController(md) {
  var subscriptions = [];

  function extensionControl (eventType?, textInView?) {
    var editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    var doc = editor.document;
    if (doc.languageId === 'markdown') {
      md.update(eventType, textInView);
    } else {
      md.close();
    }
  }

  function activeTextEditorChange(event) {
    var textInView = getTextInViewScroll(event.textEditor as vscode.TextEditor);
    extensionControl('scroll', textInView)
  }
  function scrollUpdate(event) {
    var textInView = getTextInViewScroll(event.textEditor as vscode.TextEditor);
    extensionControl('scroll', textInView)
  }
  function cursorUpdate(event) {
    var textInView = getTextInViewCursor(event.textEditor as vscode.TextEditor);
    extensionControl('cursor', textInView)
  }
  vscode.window.onDidChangeActiveTextEditor(activeTextEditorChange, this, subscriptions);
  vscode.window.onDidChangeTextEditorSelection(
    cursorUpdate,
    this,
    subscriptions
  );
  vscode.window.onDidChangeTextEditorVisibleRanges(
    scrollUpdate,
    this,
    subscriptions
  );

  extensionControl()
}

function getTextInViewScroll(editor: vscode.TextEditor) {
  if (!editor['visibleRanges'].length) {
    return undefined;
  }

  var view = editor['visibleRanges'][0];
  var start = view.start;
  var end = view.end;

  var startLine = start.line;
  var endLine = end.line;

  var startCharacter = start.character;
  var endCharacter = end.character;

  var textInView = editor.document.getText(
    new vscode.Range(startLine, startCharacter, endLine, endCharacter)
  );

  return textInView;
}

function getTextInViewCursor(editor: vscode.TextEditor) {
  var currentLocation = editor.selection.active;

  var startLine = 0;
  var endLine = currentLocation.line;

  var startCharacter = 0;
  var endCharacter = currentLocation.character;

  var textInView = editor.document.getText(
    new vscode.Range(startLine, startCharacter, endLine, endCharacter)
  );

  let nextChar = editor.document.getText(
    new vscode.Range(endLine, endCharacter + 1, endLine, endCharacter + 2)
  );
  if (!nextChar) {
    textInView = textInView.split('\n').slice(0, -1).join('\n');
  }

  return textInView;
}

exports.activate = activate;
