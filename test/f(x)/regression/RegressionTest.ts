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

  // TODO:
  // attach a file name to the datatable
  private runData: DataTable;
  private runDelta: DataTable;
  private runParameters: DataTable;
  private runErrors: DataTable;
  private runErrorsMap = new Map<string, string>(); // map of error message to error hash string, stored in file .errors.csv

  // where files are stored
  private testDataDir = "test/data/";
  private runDir = this.testDataDir.concat("run/"); // to do add date/time suffix
  private goodDir = this.testDataDir.concat("good/");
  // and what they are called
  // private runFilePatternPath: string;
  private dataFileName: string;
  private deltaFileName: string;
  private parametersFileName: string;
  private errorsFileName: string;

  public hasIndependent(v: Variable): boolean {
    //return this.runData.keyFields.includes(v.name);
    return this.independents.map((i) => i.name).includes(v.name);
  }

  // TODO: get rid of the variables - they are all actions, maybe?
  constructor(
    runName: string,
    public system: RegressionSystem,
    public independents: Variable[],
    public actions: string[],
    calculationFilter?: string[],
  ) {
    // set up the file names consistently
    runName = runName + "." + [...independents.map((v) => v.name)].slice(1).join("_x_"); // TODO: get this passed in

    const dataSuffix = ".data";
    const deltaSuffix = ".delta";
    const errorsSuffix = ".errors";
    const parametersSuffix = ".parameters";
    const fileType = ".csv";

    //this.runFileNamePatternPath = this.runDir + runName + ".*" + fileType;
    this.dataFileName = runName + dataSuffix + fileType;
    this.deltaFileName = runName + deltaSuffix + fileType;
    this.parametersFileName = runName + parametersSuffix + fileType;
    this.errorsFileName = runName + errorsSuffix + fileType;

    // delete the run files (not the good one)
    this._remove(this.dataFileName);
    this._remove(this.deltaFileName);
    this._remove(this.parametersFileName);
    this._remove(this.errorsFileName);

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

    let keyFields =
      //[...independents.map((v) => v.name)].concat(actions.length ? ["actionName", "actionResult"] : []),
      [...this.independents.map((v) => v.name)];
    let dataFields = [...this.actions, ...this.calculations.map((state) => state.name)];

    this.runData = new DataTable(keyFields, dataFields);
    this.runDelta = new DataTable(keyFields, dataFields);

    let parameters = this.system.variables.filter((v) => !this.hasIndependent(v));
    this.runParameters = new DataTable(
      [],
      parameters.map((v) => v.name),
    );
    this.runParameters.addRow(parameters.map((v) => formatEther(v.value)));
    this.runErrors = new DataTable(["code", "message"], []);
  }

  private formatError(e: any): string {
    let message = e.message || "undefined error";
    let code = this.runErrorsMap.get(message) || ""; // have we encountered this error text before?
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
      this.runErrorsMap.set(message, code);
      this.runErrors.addRow([code, message]);
    }
    return code;
  }

  private formatDelta(before: bigint, after: bigint): string {
    const result = after - before;
    return (result > 0n ? "+" : "") + formatEther(result);
  }

  public async data() {
    // now add one (or more) rows of data:
    // one column for each action
    // one row, no actions
    // then execute actions - if they pass it's a new line, else go on to the next action

    let currentAction = -1; // do a line before any actions
    do {
      let dataLine: string[] = [];

      this.independents.forEach((variable) =>
        // add a 0.1 for each action
        dataLine.push(
          formatEther(variable.value + (variable.name == "index" ? BigInt((currentAction + 1) * 1e17) : 0n)),
        ),
      );
      // one action at a time
      for (let a = 0; a < this.actions.length; a++) {
        if (a == currentAction) {
          try {
            let fn = this.system.actions.get(this.actions[a]);
            if (fn) await fn(); // await is needed
            dataLine.push("\\o/"); // success
          } catch (e: any) {
            dataLine.push(this.formatError(e)); // failure
            currentAction++;
          }
        } else {
          dataLine.push("---"); // not executed
        }
      }
      let deltaLine = dataLine.slice(); // copy it

      let first = true;
      for (let calcState of this.calculations) {
        let dataText: string;
        let deltaText: string;
        try {
          let value = await calcState.func();
          dataText = formatEther(value);
          deltaText = this.formatDelta(calcState.prevValue, value);

          calcState.allZeros = calcState.allZeros && value == 0n;
          calcState.prevValue = value;
        } catch (e: any) {
          dataText = this.formatError(e);
          deltaText = dataText;
        }
        if (!first) calcState.allSame = calcState.allSame && dataText == calcState.prevText;
        dataLine.push(dataText);
        deltaLine.push(deltaText);
        calcState.prevText = dataText;
        first = false;
      }

      this.runData.addRow(dataLine);
      this.runDelta.addRow(deltaLine);
    } while (++currentAction < this.actions.length);
  }

  public async done() {
    fs.writeFileSync(this.runDir + this.errorsFileName, toCSV(this.runErrors));
    fs.writeFileSync(this.runDir + this.parametersFileName, toCSV(this.runParameters));
    fs.writeFileSync(this.runDir + this.dataFileName, toCSV(this.runData));
    fs.writeFileSync(this.runDir + this.deltaFileName, toCSV(this.runDelta));

    // now compare them
    this.compare(this.dataFileName);
    this.compare(this.deltaFileName);
    this.compare(this.parametersFileName);
    this.compare(this.errorsFileName);
  }

  private compare(fileName: string) {
    const goodFilePath = this.goodDir + fileName;
    const runFilePath = this.runDir + fileName;
    expect(
      fs.existsSync(goodFilePath),
      `The good file (${goodFilePath}) doesn't exist. If this run is good,\n` +
        `      cp ${runFilePath} ${this.goodDir}`,
    ).to.be.true;

    const run = fs.readFileSync(runFilePath, "utf-8");
    const good = fs.readFileSync(goodFilePath, "utf-8");
    expect(run).to.equal(
      good,
      "This run is different to the good one.\n" +
        "      Compare the run results to the good resuts, e.g.\n" +
        `         bcompare ${runFilePath} ${goodFilePath}\n` +
        "      Then, if this run is good,\n" +
        `         cp ${runFilePath} ${goodFilePath}`,
    );
  }

  private _remove = (fileName: string) => {
    const runFilePath = this.runDir + fileName;
    if (fs.existsSync(runFilePath)) fs.unlinkSync(runFilePath);
  };
}

///////////////////////////////////////
