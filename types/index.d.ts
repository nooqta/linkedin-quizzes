export function getQuestionText(question: any, name: any): Promise<any[]>;
export function prepareQuestion(name: any, question: any, answers: any, choices: any): Promise<{
    type: string;
    name: string;
    message: string;
    choices: any;
}>;
export function displayResult(answers: any): Promise<void>;
export function checkAnswer(answers: any, choices: any, value: any, references: any, opts: any): Promise<any>;
export function extractQuestionsFromMd(filename: any): Promise<any[]>;
export function getChoices(node: any): Promise<{
    choices: any[];
    answers: string[];
    references: any[];
}>;
export function getQuestion(node: any): Promise<any[]>;
declare function startQuiz(name: any, opts?: {
    showAnswer: boolean;
    showCorrectAnswer: boolean;
    showReference: boolean;
    showScore: boolean;
}): Promise<void>;
export function newQuiz(): Promise<void>;
export function promptTotal(max?: number): Promise<any>;
export function promptQuiz(): Promise<any>;
/**
 *
 * @param {string} source - the node_modules folder
 * @returns {string[]} - An array of folder names
 */
export function getQuizzes(source?: string): string[];
/**
 * @param {string} source - The source folder to read from
 * @returns {string[]} - An array of folder names
 */
export function getDirectories(source: string): string[];
export { startQuiz as getQuiz };
