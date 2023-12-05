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

/*
type ActorFunction = () => {};

export class Actor {
  // TODO: add a map to prevent duplicate variables
  // An actor is an independent variable that is updated by the act function

  constructor(
    system: RegressionSystem,
    public name: string,
    public act: ActorFunction, // TODO: add these? public calculations: Calculation[],
  ) {
    system.getAllActors().set(name, act);
  }
}

export class Calculation {
  constructor(system: RegressionSystem, public name: string, public calc: () => Promise<bigint>) {
    // TODO: should just be a push
    system.getAllCalculations().set(name, calc);
  }
}
*/

// export type NamedAddress = { name: string; address: string };
type ActionFunction = () => {};
type CalculationFunction = () => Promise<bigint>;
type InstanceCalculationFunction = (instance: any) => Promise<bigint>;
type TypeFunction = { name: string; instanceCalculation: InstanceCalculationFunction };

function unInstance(fn: InstanceCalculationFunction, instance: any): CalculationFunction {
  return () => {
    return fn(instance);
  };
}

// instantiate a RegressionSystem
export class RegressionSystem {
  // TODO: add a map to prevent duplicate variables
  public variables: Variable[] = [];

  public calculations = new Map<string, CalculationFunction>(); // insertion order is retained in Map
  public actions = new Map<string, ActionFunction>(); // insertion order is retained in Map

  // smart way of automatically defining new calculations
  /*
  private tokens = new Map<string, string>();
  private contracts = new Map<string, string>();
  private users = new Map<string, string>();
  */

  public defVariable(name: string, value: bigint): Variable {
    let result = new Variable(name, value);
    this.variables.push(result);
    return result;
  }

  public defCalculation(name: string, calc: CalculationFunction): string {
    this.calculations.set(name, calc);
    return name;
  }

  public defAction(name: string, act: ActionFunction): string {
    this.actions.set(name, act);
    return name;
  }

  // define a set of calculations to be applied to all things of a given type
  public typeFunctions = new Map<string, TypeFunction[]>();
  public defType(type: string, calcForAll?: TypeFunction[]): string {
    if (calcForAll) this.typeFunctions.set(type, calcForAll);
    return type;
  }

  /*
  public defRelation<T1, T2>(
    forEach: string,
    name: string,
    withEach: string,
    value: (a: T1, b: T2) => Promise<bigint>,
  ): string {
    // TODO: return a structure
    return forEach.concat("_x_").concat(withEach);
  }
  */

  // this should be
  // defType("token");
  // defThing(MyToken, "token");
  // defRelation("user", "has", "token", (a: UserType, b: TokenType) => { return calculation result } )
  /*
  public defToken(name: string, address: string) {
    this.tokens.set(name, address);
  }

  public defContract(name: string, address: string) {
    this.contracts.set(name, address);
  }

  public defUser(name: string, address: string) {
    this.users.set(name, address);
  }
*/
  public initialise() {
    // create calculations for tokens, users & contracts

    this.variables.forEach((v) => v.initialise());
  }
}

// each RegressionTest is part of a RegressionSystem
export class RegressionTest {
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
  private runParametersFilePath: string;
  private runErrorsFilePath: string;
  private runDiffsFilePath: string;
  private goodDataFilePath: string;

  public hasIndependent(v: Variable): boolean {
    //return this.runData.keyFields.includes(v.name);
    return this.independents.map((i) => i.name).includes(v.name);
  }

  public defThing<T extends { name: string }>(that: T, type: string) {
    let fns = this.system.typeFunctions.get(type);
    if (fns) {
      fns.forEach((value) => {
        console.log(
          "type %s calculation for %s x %s: ",
          type,
          that.name,
          value.name,
          that.name.concat(".").concat(value.name),
        );
        this.system.calculations.set(that.name.concat(".").concat(value.name), () => {
          return value.instanceCalculation(that);
        });
      });
    }
  }

  // TODO: get rid of the variables - they are all actors, maybe?
  constructor(
    public system: RegressionSystem,
    public independents: Variable[],
    public actions: string[],
    public calculations?: string[],
  ) {
    // set up the file names consistently
    const runName = [...independents.map((v) => v.name)].slice(1).join("_x_"); // TODO: get this passed in

    const dataSuffix = ".data.csv";
    const errorsSuffix = ".errors.csv";
    const parametersSuffix = ".parameters.csv";
    const diffsSuffix = ".diffs.txt";

    this.runFilePatternPath = this.runDir.concat(runName).concat(".*.csv");
    this.runDataFilePath = this.runDir.concat(runName).concat(dataSuffix);
    this.runParametersFilePath = this.runDir.concat(runName).concat(parametersSuffix);
    this.runErrorsFilePath = this.runDir.concat(runName).concat(errorsSuffix);
    this.runDiffsFilePath = this.runDir.concat(runName).concat(diffsSuffix);
    this.goodDataFilePath = this.goodDir.concat(runName).concat(dataSuffix);

    // delete the run files (not the good one)
    if (fs.existsSync(this.runDataFilePath)) fs.unlinkSync(this.runDataFilePath);
    if (fs.existsSync(this.runParametersFilePath)) fs.unlinkSync(this.runParametersFilePath);
    if (fs.existsSync(this.runErrorsFilePath)) fs.unlinkSync(this.runErrorsFilePath);
    if (fs.existsSync(this.runDiffsFilePath)) fs.unlinkSync(this.runDiffsFilePath);
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
    if (!this.runData) {
      // initialise the datatable
      // reset all the variables to their initial values
      this.system.initialise();

      console.log(this.system.calculations.keys());

      this.runData = new DataTable(
        //[...independents.map((v) => v.name)].concat(actors.length ? ["actionName", "actionResult"] : []),
        [...this.independents.map((v) => v.name)],
        [...this.actions].concat([...this.system.calculations.keys()]),
      );

      // TODO: use the DataTable for generating this parameter info
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
    // now add one (or more) rows of data:
    // one column for each actor
    // one row, no actors
    // then execute actors - if they pass it's a new line, else go on to the next actor

    let currentActor = -1;
    do {
      let line: string[] = [];

      this.independents.forEach((variable) => line.push(formatEther(variable.value)));
      // one actor at a time
      for (let a = 0; a < this.actions.length; a++) {
        if (a == currentActor) {
          try {
            let fn = this.system.actions.get(this.actions[a]);
            if (fn) await fn(); // TODO: check if await is needed
            line.push(":-)");
          } catch (e: any) {
            line.push(this.formatError(e));
            currentActor++;
          }
        } else {
          line.push("-");
        }
      }

      for (let cfn of this.system.calculations.values()) {
        try {
          line.push(formatEther(await cfn()));
        } catch (e: any) {
          line.push(this.formatError(e));
        }
      }
      this.runData.addRow(line);
    } while (++currentActor < this.actions.length);
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
      "The good file doesn't exist. If this run is good,\n      cp "
        .concat(this.runFilePatternPath)
        .concat(" ")
        .concat(this.goodDir),
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
