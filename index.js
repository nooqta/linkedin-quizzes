const highlight = require('cli-highlight').highlight;
const languagesList = require('cli-highlight').listLanguages();
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const prompts = require('prompts');
const glob = require('glob');

/**
 * @param {string} source - The source folder to read from
 * @returns {string[]} - An array of folder names
 */
const getDirectories = source =>
  fs.readdirSync(source, {
    withFileTypes: true
  })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)


/**
 * 
 * @param {string} source - the node_modules folder
 * @returns {string[]} - An array of folder names
 */
const getQuizzes = (source = 'linkedin-assessments-quizzes') => {
  const dir = path.join(process.cwd(), 'node_modules', source);
  const directories = getDirectories(dir).filter(directory => !directory.startsWith('.')).map(directory => ({
    title: directory,
    value: directory
  }));
  return directories;
}

const promptQuiz = async () => {
  const {
    value
  } = await prompts({
    type: 'autocomplete',
    name: 'value',
    message: 'Select a quiz',
    choices: getQuizzes()
  });
  return value;
}

const promptTotal = async (max = 10) => {
  const {
    value
  } = await prompts({
    type: 'number',
    name: 'value',
    message: 'How many questions would you like to have?',
    initial: 0,
    style: 'default',
    min: 2,
    max
  });
  return value;
}
const newQuiz = async () => {
  const name = await promptQuiz();
  await startQuiz(name);
}

const defaultOptions = {
  showAnswer: true,
  showCorrectAnswer: true,
  showReference: true,
  showScore: true
}
const getQuizFile = async (name) => {
  glob(path.join(process.cwd(), 'node_modules', 'linkedin-assessments-quizzes', name, '*quiz.md'), {windowsPathsNoEscape: true}, async (err, files) => {
  const files = glob.sync(path.join(dir, '*quiz.md'));
  if (files.length === 0) {
    throw new Error(`No quiz file found in ${dir}`);
    process.exit(1);
  }
  return files[0];
}

const startQuiz = async (name, opts = defaultOptions) => {
  glob(path.join(process.cwd(), 'node_modules', 'linkedin-assessments-quizzes', name, '*quiz.md'), async (err, files) => {
    if (err || files.length === 0) {
      console.log(err || 'No quiz found');
      process.exit(1);
    }

    const quizFile = files[0];

    const questions = await extractQuestionsFromMd(`${quizFile}`);
    const candidateAnswers = [];
    const total = await promptTotal(questions.length);
    const quizQuestions = _.sampleSize(questions, total);
    for await (const node of quizQuestions) {
      const question = await getQuestion(node);
      const {
        choices,
        answers,
        references
      } = await getChoices(node);

      const promptQuestion = await prepareQuestion(name, question, answers, choices);
      console.clear();
      const {
        value
      } = await prompts(promptQuestion);
      candidateAnswers.push(await checkAnswer(answers, choices, value, references, opts));

    }
    if (opts.showScore) {
      displayResult(candidateAnswers);
    }
  });

}

const getQuestion = async (node) => {
  const chalk = (await import('chalk')).default;
  const {
    visit
  } = await import('unist-util-visit')
  let questionParts = [];
  for await (const child of node.children) {
    if (child.type === 'list') break;
    if (['paragraph', 'heading', 'code'].includes(child.type)) {
      visit(child, child.type, async (_node, _, parent) => {
        if (_node.type === 'heading') {
          visit(_node, 'heading', (_child, index, parent) => {
            questionParts.push({
              type: 'text',
              value: chalk.dim.italic(_child.value || _child.children.map(node => node.value).join(''))
            });
          });
        } else {
          if (_node.type === 'code') {
            questionParts.push({
              type: 'code',
              value: '\n\n' + highlight(_node.value, {
                language: _node.lang,
                ignoreIllegals: true,
                lineNumbers: true
              }) + '\n\n'
            });
          }
          if (_node.type === 'paragraph') {
            for await (const __node of _node.children) {
              if (__node.type === 'inlineCode') {
                questionParts.push({
                  type: 'inlineCode',
                  value: highlight(__node.value, {
                    language: __node.lang,
                    ignoreIllegals: true
                  })
                })
              } else if (__node.type === 'image') {
                questionParts.push({
                  type: 'image',
                  value: __node.url
                });;
              }
            }
          }
        }
      })
    }
  }

  return questionParts;
}

const getChoices = async (node) => {
  const {
    visit
  } = await import('unist-util-visit')
  const filtereChildren = [];
  let listFound = false;
  for (const [i, child] of node.children.entries()) {
    if (child.type !== 'list' && !listFound) {
      listFound = true
    } else {
      filtereChildren.push(child);
    }
  }
  node.children = filtereChildren;
  let choices = [];
  const answers = [];
  // @todo: add the references
  const references = [];
  visit(node, ['list', 'code'], (node, _, parent) => {
    // This is a special case for the code block within the list. We need concatenate the code blocks to the choices.
    if (node.type == 'code') {
      choices[choices.length - 1] = choices[choices.length - 1] + '\n' + highlight(node.value, {
        language: languagesList.includes[node.lang] ? node.lang : 'plaintext',
        ignoreIllegals: true
      });
    }
    if (!node.ordered) {
      visit(node, 'paragraph', (node, _, parent) => {
        choices.push(node.children.map(node => {
          if (node.type === 'text' || node.type === 'inlineCode') {
            return node.value;
          } else {
            if (node.type === 'code') {
              return '\n' + highlight(node.value, {
                language: node.lang,
                ignoreIllegals: true
              });
            }
            if (node.type === 'link')
              return node.children.map(node => node.value).join('') + ': ' + node.url;
          }
        }).join(''));
      });
    } else {
      visit(node, 'paragraph', (node, _, parent) => {
        references.push(node.children.map(node => {
          if (node.type === 'text' || node.type === 'inlineCode') {
            return node.value;
          } else {
            if (node.type === 'link')
              return node.children.map(node => node.value).join('') + ': ' + node.url;
          }
        }).join(''));
      });
    }
  })
  answers.push(choices.filter(value => value.includes('[x] ')).map(value => value.replace('[x] ', '')).join(''));
  choices = choices.map(choice => choice.replace('[ ] ', '').replace('[x] ', ''));
  return {
    choices,
    answers,
    references
  };
}


async function extractQuestionsFromMd(filename) {
  const remark = await import('remark');
  const remarkParse = await import('remark-parse');

  const quizFile = fs.readFileSync(filename, 'utf8');
  const content = remark.remark()
    .use(remarkParse)
    .parse(quizFile);
  const questions = content.children.reduce((acc, node) => {
    if (node.type == 'heading' && node.depth === 4) {
      acc.push({
        type: 'root',
        children: [node]
      });
    } else {
      if (acc.length > 0) {
        acc[acc.length - 1].children.push(node);
      }
    }
    return acc;
  }, []);
  return questions;
}

async function checkAnswer(answers, choices, value, references, opts) {
  const boxen = (await import('boxen')).default;
  const chalk = (await import('chalk')).default;
  const isCorrect = answers.includes(choices[value]);
  if (!opts.showAnswer) return isCorrect;
  let message = '';
  if (isCorrect) {
    console.log(boxen(chalk.green.bold('✓ Correct!'), {
      textAlignment: 'center',
      borderColor: 'green',
      borderStyle: 'round'
    }));
  } else {
    if (opts.showCorrectAnswer) {
      message = `${chalk.red.bold(`x`)} ${chalk.dim.italic(`Correct answer is:`)} ${chalk.green(answers.join(', '))}`;
    } else {
      message = `${chalk.red.bold(`x`)} ${chalk.red(`Incorrect`)}`;
    }
    console.log(boxen(message, {
      textAlignment: 'center',
      padding: 1,
      borderColor: 'red',
      borderStyle: 'round'
    }));
  }
  if (opts.showReference) {
    message = references.join('\n');
    message && console.log(boxen(message, {
      textAlignment: 'left',
      borderColor: 'white',
      borderStyle: 'round'
    }));
    await new Promise(resolve => setTimeout(resolve, opts.showReference? 2500:1500));
  }
  return isCorrect
}

async function displayResult(answers) {
  const boxen = (await import('boxen')).default;
  const chalk = (await import('chalk')).default;
  const score = answers.reduce((acc, value) => {
    if (value) {
      acc++;
    }
    return acc;
  }, 0);
  let message = `${ score == answers.length? '🏆\n':''}You got ${chalk.green(score)} out of ${chalk.green(answers.length)} correct!\n`;
  message += `${chalk.green.bold(`${score}/${answers.length}`)}\n`;
  message += `Your score is ${Math.round((score / answers.length) * 100)}%`;
  console.log(boxen(message, {
    textAlignment: 'center',
    padding: 1,
    borderColor: 'green',
    borderStyle: 'round'
  }));
}

async function prepareQuestion(name, question, answers, choices) {
  const message = await getQuestionText(question, name);
  const promptQuestion = {
    type: answers.length > 1 ? 'multiselect' : 'select',
    name: 'value',
    message: message.join(''),
    choices: choices,
  };
  return promptQuestion;
}

async function getQuestionText(question, name) {
  const terminalImage = (await import('terminal-image')).default;
  return await (Promise.all(question.map(async (node) => {
    if (node.type === 'image') {
      return '\n' + await terminalImage.file(`${path.join(process.cwd(), 'node_modules',  'linkedin-assessments-quizzes',  name)}/${node.value}`);
    } else {
      return node.value;
    }
  })));
}

(function () {
  'use strict';

  module.exports = {
    getQuestionText,
    prepareQuestion,
    displayResult,
    checkAnswer,
    extractQuestionsFromMd,
    getChoices,
    getQuestion,
    startQuiz,
    newQuiz,
    promptTotal,
    promptQuiz,
    getQuizzes,
    getDirectories,
    getQuizFile
  };
}());