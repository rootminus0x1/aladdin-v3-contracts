import { expect } from "chai";
import * as fs from "fs";
import { parseEther, formatEther } from "ethers";
import { DataTable, fromCSV, toCSV, diff } from "./DataTable";
import * as crypto from "crypto-js";
//import 'command-exists';
import commandExists from "command-exists";
import { execSync } from "child_process";
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from "constants";

import { ContractWithAddress, UserWithAddress } from "test/useful";
import { string } from "hardhat/internal/core/params/argumentTypes";

//////////////////////////////////
// regression system

// create variables by simply declaring variables of type Variable
export class Variable {
  public initialValue: bigint;

  constructor(public name: string, public value: bigint) {
    this.initialValue = value;
  }

  public initialise() {
    this.value = this.initialValue;
  }
}

// export type NamedAddress = { name: string; address: string };
type ActionFunction = () => {};
type CalculationFunction = () => Promise<bigint>;
// TODO: maybe change those any's into templated types
type InstanceCalculationFunction = (instance: any) => Promise<bigint>;
type TypeNameFunction = { name: string; calc: InstanceCalculationFunction };
type RelationCalculationFunction = (a: any, b: any) => Promise<bigint>;
type RelationNameFunction = { name: string; calc: RelationCalculationFunction };

// instantiate a RegressionSystem
export class RegressionSystem {
  // TODO: add a map to prevent duplicate variables
  public variables: Variable[] = [];

  public calculations = new Map<string, CalculationFunction>(); // insertion order is retained in Map
  public actions = new Map<string, ActionFunction>(); // insertion order is retained in Map

  constructor(
    private aliases = new Map<string, string>(), // rename strings
    public separator = ".",
  ) {}

  private alias(orig: string): string {
    // replace all occurences of aliases keys in the orig string, with the alias value
    // return this.aliases.get(orig) || orig; only replaces the
    let result = orig;
    this.aliases.forEach((_v, _k) => {
      result = result.replace(new RegExp(`(\\b)${_k}(\\b)`, "g"), `$1${_v}$2`);
    });
    return result;
  }

  public defVariable(name: string, value: bigint): Variable {
    let result = new Variable(this.alias(name), value);
    this.variables.push(result);
    return result;
  }

  public defCalculation(name: string, calc: CalculationFunction): string {
    let rename = this.alias(name);
    this.calculations.set(rename, calc);
    return rename;
  }

  public defAction(name: string, act: ActionFunction): string {
    let rename = this.alias(name);
    this.actions.set(rename, act);
    return rename;
  }

  // define a set of calculations to be applied to all things of a given type
  public typeFunctions = new Map<string, TypeNameFunction[]>();
  public defType(type: string, calcForAll?: TypeNameFunction[]): string {
    if (calcForAll) this.typeFunctions.set(type, calcForAll);
    return type;
  }

  private thingTypes = new Map<string, any[]>();
  public defThing<T extends { name: string }>(that: T, type: string) {
    this.thingTypes.set(type, [...(this.thingTypes.get(type) || []), that]); // store it for the relations below
    let fns = this.typeFunctions.get(type); // returning null is OK as there may just be no functions
    if (fns) {
      fns.forEach((value) => {
        this.calculations.set(this.alias(that.name) + this.separator + this.alias(value.name), () => {
          return value.calc(that);
        });
      });
    }
    return that.name.concat(" is ").concat(type);
  }

  // TODO: make defRelation delay its evaluation until the regression test is constructed
  // defines the relationship between types of things
  public relationFunctions = new Map<string, RelationNameFunction[]>();
  public defRelation<T1 extends { name: string }, T2 extends { name: string }>(
    forEachType: string,
    withEachType: string,
    calcs: RelationNameFunction[],
  ) {
    let forEachs = this.thingTypes.get(forEachType) || [];
    let withEachs = this.thingTypes.get(withEachType) || [];
    forEachs.forEach((forValue) => {
      withEachs.forEach((withValue) => {
        calcs.forEach((calc) => {
          if (forValue != withValue) {
            this.calculations.set(this.alias(forValue.name) + this.separator + this.alias(withValue.name), () => {
              return calc.calc(forValue, withValue); // curried
            });
          }
        });
      });
    });
    // TODO: return a structure
    // return forEach.concat("_x_").concat(withEach);
  }

  public initialise() {
    // create calculations for tokens, users & contracts

    this.variables.forEach((v) => v.initialise());
  }
}

type CalculationState = {
  name: string;
  func: CalculationFunction;
  // this is filled in during the calculations
  allZeros: boolean; // can be removed for slim file
  prevValue: bigint; // used to determine the above and also work out deltas
  allSame: boolean; // can be removed in skinny file
  prevText: string;
};

// each RegressionTest is part of a RegressionSystem
export class RegressionTest {
  // what to show
  private calculations: CalculationState[] = [];
  // the data
  private runParameters: string[] = []; // stored in file .parameters.csv
  private runData: DataTable;
  private runErrors = new Map<string, string>(); // map of error message to error hash string, stored in file .errors.csv

  // where files are stored
  private testDataDir = "test/data/";
  private runDir = this.testDataDir.concat("run/"); // to do add date/time suffix
  private goodDir = this.testDataDir.concat("good/");
  // and what they are called
  private runFilePatternPath: string;
  private runDataFilePath: string;
  private runDeltaFilePath: string;
  private runParametersFilePath: string;
  private runErrorsFilePath: string;
  private goodDataFilePath: string;

  public hasIndependent(v: Variable): boolean {
    //return this.runData.keyFields.includes(v.name);
    return this.independents.map((i) => i.name).includes(v.name);
  }

  // TODO: get rid of the variables - they are all actions, maybe?
  constructor(
    public system: RegressionSystem,
    public independents: Variable[],
    public actions: string[],
    calculationFilter?: string[],
  ) {
    // set up the file names consistently
    const runName = [...independents.map((v) => v.name)].slice(1).join("_x_"); // TODO: get this passed in

    const dataSuffix = ".data";
    const deltaSuffix = ".data";
    const errorsSuffix = ".errors";
    const parametersSuffix = ".parameters";
    const fileType = ".csv";

    this.runFilePatternPath = this.runDir + runName + ".*" + fileType;
    this.runDataFilePath = this.runDir + runName + dataSuffix + fileType;
    this.runDeltaFilePath = this.runDir + runName + dataSuffix + fileType;
    this.runParametersFilePath = this.runDir + runName + parametersSuffix + fileType;
    this.runErrorsFilePath = this.runDir + runName + errorsSuffix + fileType;
    this.goodDataFilePath = this.goodDir + runName + dataSuffix + fileType;

    // delete the run files (not the good one)
    if (fs.existsSync(this.runDataFilePath)) fs.unlinkSync(this.runDataFilePath);
    if (fs.existsSync(this.runDeltaFilePath)) fs.unlinkSync(this.runDeltaFilePath);
    if (fs.existsSync(this.runParametersFilePath)) fs.unlinkSync(this.runParametersFilePath);
    if (fs.existsSync(this.runErrorsFilePath)) fs.unlinkSync(this.runErrorsFilePath);

    // initialise the datatable
    // reset all the variables to their initial values
    this.system.initialise();

    // default calculations to sorted (case-insensitive) list
    for (let calcName of calculationFilter ||
      [...this.system.calculations.keys()].sort((a, b) =>
        a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0,
      )) {
      // TODO: ensure the calculations ae properly aliased (the ones from system should already be)
      // maybe we don't allow selection because we have slim, deltas, slim-deltas reports and
      let calcFn = this.system.calculations.get(calcName);
      if (calcFn) {
        this.calculations.push({
          name: calcName,
          func: calcFn,
          allZeros: false,
          allSame: false,
          prevValue: 0n,
          prevText: "",
        });
      } else {
        throw "unknown calculation: " + calcName;
      }
    }

    this.runData = new DataTable(
      //[...independents.map((v) => v.name)].concat(actions.length ? ["actionName", "actionResult"] : []),
      [...this.independents.map((v) => v.name)],
      [...this.actions, ...this.calculations.map((state) => state.name)],
    );

    // TODO: use the DataTable for generating this parameter info
    // TODO: or put the error and parameter info in as comments # in the data file
    // and print out all the header info
    let phead: string[] = [];
    let pdata: string[] = [];

    // all variables that are not independent are static and listed as parameters
    // if a new variable is added then do file names change?, no
    // what about parameters that vary from the default, e.g. beta, should do really
    for (let av of this.system.variables) {
      if (!this.hasIndependent(av)) {
        phead.push(av.name);
        pdata.push(formatEther(av.value)); // TODO: make this work with more types - e.g. should I assume its a 1e18 scaled number?
      }
    }
    this.runParameters.push(phead.join());
    this.runParameters.push(pdata.join());
  }

  private formatError(e: any): string {
    let message = e.message || "undefined error";
    let code = this.runErrors.get(message) || ""; // have we encountered this error text before?
    if (code == "") {
      // first time this message has occurred - generate the code
      const match = message.match(/'([^']*)'$/);
      // TODO: ensure the code/message combination is unique
      if (match && match.length === 2) {
        code = match[1];
      } else {
        //const hash = createHash("sha256").update(message).digest("base64");
        const hash = crypto.SHA3(message, { outputLength: 32 }).toString(crypto.enc.Base64);
        code = "ERR: ".concat(hash);
      }
      // TODO: ensure the code/message combination is unique - if not add a digit to the end representing the count
      this.runErrors.set(message, code);
    }
    return code;
  }

  public async data() {
    // now add one (or more) rows of data:
    // one column for each action
    // one row, no actions
    // then execute actions - if they pass it's a new line, else go on to the next action

    let currentAction = -1; // do a line before any actions
    do {
      let line: string[] = [];

      this.independents.forEach((variable) =>
        // add a 0.1 for each action
        line.push(formatEther(variable.value + (variable.name == "index" ? BigInt((currentAction + 1) * 1e17) : 0n))),
      );
      // one action at a time
      for (let a = 0; a < this.actions.length; a++) {
        if (a == currentAction) {
          try {
            let fn = this.system.actions.get(this.actions[a]);
            if (fn) await fn(); // await is needed
            line.push("\\o/"); // success
          } catch (e: any) {
            line.push(this.formatError(e)); // failure
            currentAction++;
          }
        } else {
          line.push("---"); // not executed
        }
      }
      let deltaLine = line.slice(); // copy it

      let first = true;
      for (let calcState of this.calculations) {
        let text: string;
        let deltaText: string;
        try {
          let value = await calcState.func();
          text = formatEther(value);
          deltaText = formatEther(value - calcState.prevValue);

          calcState.allZeros = calcState.allZeros && value == 0n;
          calcState.prevValue = value;
        } catch (e: any) {
          text = this.formatError(e);
          deltaText = text;
        }
        if (!first) calcState.allSame = calcState.allSame && text == calcState.prevText;
        line.push(text);
        deltaLine.push(deltaText);
        calcState.prevText = text;
        first = false;
      }

      this.runData.addRow(line);
    } while (++currentAction < this.actions.length);
  }

  public async done() {
    // write the parameters file
    const runParameters = this.runParameters.join("\n");
    fs.writeFileSync(this.runParametersFilePath, runParameters);

    // write the errors file
    let runErrors: [string, string][] = [["no ", "errors"]];
    if (this.runErrors.size > 0) {
      runErrors = Array.from(this.runErrors, ([k, v]) => [v.toString(), k]);
      runErrors.unshift(["code", "message"]);
    }
    fs.writeFileSync(this.runErrorsFilePath, runErrors.join("\n"));

    // write the data file
    const runData = toCSV(this.runData);
    fs.writeFileSync(this.runDataFilePath, runData);

    // now compare them
    // TODO: compare the parameters and errors too
    expect(
      fs.existsSync(this.goodDataFilePath),
      `The good file (${this.goodDataFilePath}) doesn't exist. If this run is good,\n` +
        `      cp ${this.runFilePatternPath} ${this.goodDir}`,
    ).to.be.true;

    /*
    hand written comparison isn't so good so,
    let diffsArray: string[] = [];
    let diffsText: string = "";
    try {
      diffsArray = diff(this.runData, fromCSV(goodData));
      diffsText = diffsArray.join("\n");
    } catch (e: any) {
      console.log("diff failed!!");
    }
    if (diffsArray.length > 0) {
      console.log("DIFFS: %s", diffsText);
      fs.writeFileSync(this.runDiffsFilePath, diffsText);
    }
    */

    // just do a string compare
    /*
    let run, good;
    let csvdiff = "csvdiff";
    if (commandExists.sync(csvdiff)) {
      csvdiff += ` ${this.runDataFilePath} ${this.goodDataFilePath}`;
      run = execSync(csvdiff, { encoding: "utf-8" });
      good = "";
    } else {
      // just do a text comparison
      run = runData;
      good = fs.readFileSync(this.goodDataFilePath, "utf-8");
    }
    */
    const run = runData;
    const good = fs.readFileSync(this.goodDataFilePath, "utf-8");
    expect(run).to.equal(
      good,
      "This run is different to the good one.\n      Compare the run results to the good resuts, e.g.\n         bcompare "
        .concat(this.runDataFilePath)
        .concat(" ")
        .concat(this.goodDataFilePath)
        .concat("\n      Then, if this run is good,\n         cp ")
        .concat(this.runFilePatternPath)
        .concat(" ")
        .concat(this.goodDir),
    );
  }
}

///////////////////////////////////////
