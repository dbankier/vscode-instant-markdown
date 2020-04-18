"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const server_1 = require("./server");
const path = require('path');
const open = require('opn');
const hljs = require('highlight.js');
const MarkdownIt = require('markdown-it');
const debounce = require('debounce');
function activate(context) {
    var instantMarkdown = new InstantMarkdown();
    var instantMarkdownController = new InstantMarkdownController(instantMarkdown);
    context.subscriptions.push(instantMarkdown);
    context.subscriptions.push(instantMarkdownController);
    context.subscriptions.push(vscode.commands.registerCommand('instantmarkdown.openBrowser', openBrowser));
}
let last_instance;
function openBrowser() {
    var port = vscode.workspace.getConfiguration("instantmarkdown").get("port");
    var host = vscode.workspace.getConfiguration("instantmarkdown").get("host");
    open("http://" + host + ":" + port);
    if (last_instance) {
        setTimeout(() => last_instance.pushMarkdown(), 1000);
    }
}
function InstantMarkdown() {
    let started = false;
    let server;
    let self = last_instance = this;
    this.initialise = function (callback) {
        if (!server) {
            server = new server_1.default({
                root: path.dirname(vscode.window.activeTextEditor.document.fileName),
                started() {
                    started = true;
                    if (vscode.workspace.getConfiguration("instantmarkdown").get("autoOpenBrowser")) {
                        openBrowser();
                    }
                }
            });
        }
    };
    this.pushMarkdown = function (event, textInView) {
        const scrollEnabled = vscode.workspace.getConfiguration("instantmarkdown").get("scroll");
        let md = new MarkdownIt('default', {
            html: true,
            linkify: true,
            highlight: function (str, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(lang, str).value;
                    }
                    catch (__) { }
                }
                return '';
            }
        });
        var beforeText = vscode.window.activeTextEditor.document.getText();
        if (event === 'scroll' && scrollEnabled) {
            var position = beforeText.indexOf(textInView);
            var afterText = beforeText.substring(0, position) + "<span id=\"instant-markdown-cursor\"></span>\n" + beforeText.substring(position, beforeText.length);
        }
        else if (event === 'cursor') {
            for (var i = 0; i < beforeText.length; i++) {
                if (beforeText[i] !== textInView[i]) {
                    var afterText = beforeText.substring(0, i) + "<span id=\"instant-markdown-cursor\"></span>" + beforeText.substring(i, beforeText.length);
                    break;
                }
            }
        }
        else {
            var afterText = beforeText;
        }
        var new_markdown = md
            .use(require('markdown-it-task-lists'))
            .use(require('markdown-it-sup'))
            .use(require('markdown-it-named-headers'))
            .use(require('markdown-it-plantuml'))
            .use(require('markdown-it-mathjax')())
            .render(afterText);
        server.send(new_markdown);
    };
    let last_debounce = vscode.workspace.getConfiguration("instantmarkdown").get("debounce");
    this.update = function (event, textInView) {
        let debouncedPush = debounce(function () { self.pushMarkdown(event, textInView); }, last_debounce);
        //check if the config has changed
        let curr_debounce = vscode.workspace.getConfiguration("instantmarkdown").get("debounce");
        if (curr_debounce !== last_debounce) {
            last_debounce = curr_debounce;
            debouncedPush = debounce(function () { self.pushMarkdown(event, textInView); }, last_debounce);
        }
        if (started) {
            debouncedPush();
        }
        else {
            this.initialise(this.pushMarkdown);
        }
    };
    this.close = function () {
        if (vscode.workspace.getConfiguration("instantmarkdown").get("autoCloseServerAndBrowser")) {
            server.close();
            server = false;
            started = false;
        }
    };
}
function InstantMarkdownController(md) {
    var subscriptions = [];
    function update() {
        var editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        var doc = editor.document;
        if (doc.languageId === "markdown") {
            md.update();
        }
        else {
            md.close();
        }
    }
    function scrollUpdate(event) {
        var textInView = getTextInViewScroll(event.textEditor);
        md.update('scroll', textInView);
    }
    function cursorUpdate(event) {
        var textInView = getTextInViewCursor(event.textEditor);
        md.update('cursor', textInView);
    }
    vscode.window.onDidChangeActiveTextEditor(update, this, subscriptions);
    vscode.window.onDidChangeTextEditorSelection(cursorUpdate, this, subscriptions);
    vscode.window.onDidChangeTextEditorVisibleRanges(scrollUpdate, this, subscriptions);
    md.update();
}
function getTextInViewScroll(editor) {
    if (!editor["visibleRanges"].length) {
        return undefined;
    }
    var view = editor["visibleRanges"][0];
    var start = view.start;
    var end = view.end;
    var startLine = start.line;
    var endLine = end.line;
    var startCharacter = start.character;
    var endCharacter = end.character;
    var textInView = editor.document.getText(new vscode.Range(startLine, startCharacter, endLine, endCharacter));
    return textInView;
}
function getTextInViewCursor(editor) {
    var currentLocation = editor.selection.active;
    var startLine = 0;
    var endLine = currentLocation.line;
    var startCharacter = 0;
    var endCharacter = currentLocation.character;
    var textInView = editor.document.getText(new vscode.Range(startLine, startCharacter, endLine, endCharacter));
    return textInView;
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map