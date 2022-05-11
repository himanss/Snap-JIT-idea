
function JSCompiler(aProcess) {
	this.process = aProcess;
	this.source = null; // a context
  this.codeHead = [
    self=>`let r = new Array(${self.r$bind.length})`,
    self=>`let v = new Array(${self.v$bind.length})`,
    self=>`let o = new Array(${self.o$bind.length})`,
    "let p = a.pop()",
    "let bop = op=>p[op].bind(p)"
  ];
  this.codeBody = [];
  this.varBinds = new Array();
  this.opBinds = new Array();
  this.regBinds = new Array();

  //TODO add context traversing tools



  this.r$bind = this.regBinds
  this.v$bind = this.varBinds
  this.o$bind = this.opBinds

}


//"binding" is the process of marking a variable as "in use"
//and are "released" when not needed allowing for reuse.
JSCompiler.prototype.bindAnonItem = function(to,onBound) {
  let ls = this[to+"$bind"];
  let v = ls.indexOf(null);
  if(v != -1){
    ls[v] = true
    if(onBound)onBound(v);
    return v;
  }
  ls.push(true);
  v = ls.length -1
  if(onBound)onBound(v);
  return v;
}

JSCompiler.prototype.bindNamedItem = function (name,to,onBound) { //naming just adds another data point
  let ls = this[to+"$bind"]
  let v = ls.indexOf(name)
  if(v != -1)return v;

  //not assigned
  v = ls.indexOf(null);
  if(v != -1){
    ls[v] = true
    if(onBound)onBound(v);
    return v;
  }
  //no null slot
  ls.push(name);
  v = ls.length -1
  if(onBound)onBound(v);
  return v;

};

JSCompiler.prototype.releaseItem = function (name) {
  if(Array.isArray(name));
  else name = name.split("$");
  if (name[0] == "l" || name[0] == "lit")return; //break if literal mode
  let ls = this[name[0]+"$bind"]
  let to = name[0]
  name = parseInt(name[1]);

  if(!ls)throw new Error("release selection failure on "+ JSON.stringify(name));

  if(!ls[name])throw new Error("cannot release non bound " +to+ " named "+name);
  ls[name] = null
};

//convert a variable token into a peace of code
JSCompiler.prototype.useItem = function (name) {
  if(Array.isArray(name));
  else name = name.split("$");
  if(name[0] === "lit" || name[0] === "l") return (name[1]);
  return `${name[0]}[${name[1]}]`;
};

JSCompiler.prototype.toString = function () {
    return 'a JSCompiler';
};

JSCompiler.prototype.compileFunction = function (aContext, implicitParamCount) {
  var block = aContext.expression,
    parameters = aContext.inputs,
      parms = [],
      hasEmptySlots = false,
      i;

  if (block instanceof CommandBlockMorph) {
    this.compileSequence(block)
  } else {
    let lastVar = this.compileExpression(block);
    this.codeBody.push(`return ${this.useItem(lastVar)};`)
  }
  let code = ["// head",...this.codeHead,"// body",...this.codeBody]

  // replace any functions with their results
  // where this = JSCompiler and arguments[0] = JSCompiler
  for (var [i,v] of code.entries()){
    if(typeof v === "function"){
      code[i] = v.call(this,this);
    }
  }

  let AsyncFunction = (async ()=>{}).constructor;

  return new AsyncFunction(
      '...a',code.join("\n")
  );
};

JSCompiler.prototype.compileSequence = function (commandBlock) {
    commandBlock.blockSequence().forEach(block => {
      this.compileExpression(block)
    });
};

JSCompiler.prototype.compileExpression = function (block) {
    var selector = block.selector,
        inputs = block.inputs();
    switch (selector) {
      case 'getVarNamed':
          {
            let v = this.bindItem(inputs[0],"vars")
            return v;
          }
        break;
      default:
      this.codeBody.push(`// ${block.selector} {`);
      let inputConnectors = block.inputs() //get inputs
      .map((item, i) => this.compileInput(item) ) //parse all inputs and bind results
      // release and use results.
      // DO NOT run this.compileInput or bindItem on the regBinds table
      // past this point until this.doOp is ran.
      .map((item,i)=>{
        this.releaseItem(item)
        return this.useItem(item);
      })
      let _return = this.doOp(block.selector,inputConnectors,true);
        this.codeBody.push("// }") //fun visual debugging
      return _return;
    }

}


JSCompiler.prototype.compileInput = function (inp) {
  if (inp.isEmptySlot && inp.isEmptySlot()) {
    this.codeBody.push("// an input is empty") //temproary
  }
  switch (true){

    case inp instanceof BlockMorph:
      if (inp.selector === 'reportGetVar') {
        var i = this.varBinds.indexOf(inp.blockSpec)
        if(i != -1)return this.useItem("l$"+i);
        let varResult = this.doOp('getVarNamed',[JSON.stringify(inp.blockSpec)],true);
        return varResult; // unfinished
      } else {
        //return compileExpression or token of Snap's null
        return this.compileExpression(inp) || "l$\"\"";
      }
      break;

    case inp instanceof MultiArgMorph:
      //tokens can also be arrays
      return ['l','WIP["multi arg"]'];
    break;

    case !(["object","function"].includes(typeof inp)):
        this.codeHead.push('throw new Error("internal compiler error: bad access")')
        return ["l","bad access:"+JSON.stringify(inp)];

    case inp instanceof ArgLabelMorph:
        	return this.compileInput(inp.argMorph());
      break;

    case inp instanceof ArgMorph:
        // literal - evaluate inline
        {
          let value = inp.evaluate();
          if(value === null)return ['l','""'];
          return ['l',JSON.stringify(value)];
        }
      break;

    default:
    this.codeBody.push(`// unhandled input`)
      return ["l",'Error("unhandled input")'];


  }
}

//write an operation to code
//NOTE: you must run useItem on a list of tokens before using it as rawArgs argument
JSCompiler.prototype.doOp = function(op,rawArgs,reports) {
  let isNew = false //is the variable new
  let i = this.bindNamedItem(op,'o',i=> {isNew = true})

  //operation is not mapped to a variable, change that
  if(isNew)this.codeHead.push(`o[${i}] = bop(${JSON.stringify(op)})`);

  let reported; //a token representing who stores the result
  if(reports === true) reported = "r$"+this.bindAnonItem("r");
  if(typeof reports == "string") reported = string;
  let leftHandSide = eported !== undefined ? this.useItem(reported)+" =" : "void"
  this.codeBody.push(`${leftHandSide} await o[${i}](${rawArgs.join(",")})`);
  return reported;
}
