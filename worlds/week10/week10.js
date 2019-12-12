"use strict"

/*--------------------------------------------------------------------------------
Note that I measured everything in inches, and then converted to units of meters
(which is what VR requires) by multiplying by 0.0254.
--------------------------------------------------------------------------------*/

const inchesToMeters = inches => inches * 0.0254;
const metersToInches = meters => meters / 0.0254;

const EYE_HEIGHT       = inchesToMeters( 69);
const HALL_LENGTH      = inchesToMeters(306);

const RING_RADIUS      = 0.0425;
const TABLE_DEPTH      = inchesToMeters( 30);
const TABLE_HEIGHT     = inchesToMeters( 29);
const TABLE_WIDTH      = inchesToMeters( 60);
const TABLE_THICKNESS  = inchesToMeters( 11/8);
const LEG_THICKNESS    = inchesToMeters(  2.5);

let enableModeler = true;

/*Example Grabble Object*/
let grabbableCube = new Obj(CG.torus);

let lathe = CG.createMeshVertices(10, 16, CG.uvToLathe,
             [ CG.bezierToCubic([-1.0,-1.0,-0.7,-0.3,-0.1 , 0.1, 0.3 , 0.7 , 1.0 ,1.0]),
               CG.bezierToCubic([ 0.0, 0.5, 0.8, 1.1, 1.25, 1.4, 1.45, 1.55, 1.7 ,0.0]) ]);
// let lathe = CG.cube;
////////////////////////////// SCENE SPECIFIC CODE

const WOOD = 0,
      TILES = 1,
      NOISY_BUMP = 2;

let noise = new ImprovedNoise();
let m = new Matrix();

function HeadsetHandler(headset) {
   this.orientation = () => headset.pose.orientation;
   this.position    = () => headset.pose.position;
}

function ControllerHandler(controller) {
   this.isDown      = () => controller.buttons[1].pressed;
   this.onEndFrame  = () => wasDown = this.isDown();
   this.orientation = () => controller.pose.orientation;
   this.position    = () => controller.pose.position;
   this.press       = () => ! wasDown && this.isDown();
   this.release     = () => wasDown && ! this.isDown();
   this.tip         = () => {
      let P = this.position();          // THIS CODE JUST MOVES
      m.save();
      m.identity();                     // THE "HOT SPOT" OF THE
      m.translate(P[0],P[1],P[2]);      // CONTROLLER TOWARD ITS
      m.rotateQ(this.orientation());    // FAR TIP (FURTHER AWAY
      m.translate(0,0,-.03);            // FROM THE USER'S HAND).
      let v = m.value();
      m.restore();
      return [v[12],v[13],v[14]];
   }
   this.center = () => {
      let P = this.position();
      m.identity();
      m.translate(P[0],P[1],P[2]);
      m.rotateQ(this.orientation());
      m.translate(0,.02,-.005);
      let v = m.value();
      return [v[12],v[13],v[14]];
   }
   let wasDown = false;
}

// (New Info): constants can be reloaded without worry
// let VERTEX_SIZE = 8;

// (New Info): temp save modules as global "namespaces" upon loads
// let gfx;

// (New Info):
// handle reloading of imports (called in setup() and in onReload())
async function initCommon(state) {
   // (New Info): use the previously loaded module saved in state, use in global scope
   // TODO automatic re-setting of loaded libraries to reduce boilerplate?
   // gfx = state.gfx;
   // state.m = new CG.Matrix();
   // noise = state.noise;
}

// (New Info):
async function onReload(state) {
   // called when this file is reloaded
   // re-initialize imports, objects, and state here as needed
   await initCommon(state);

   // Note: you can also do some run-time scripting here.
   // For example, do some one-time modifications to some objects during
   // a performance, then remove the code before subsequent reloads
   // i.e. like coding in the browser console
}

// (New Info):
async function onExit(state) {
   // called when world is switched
   // de-initialize / close scene-specific resources here
   console.log("Goodbye! =)");
}

async function setup(state) {
   hotReloadFile(getPath('week10.js'));
   // (New Info): Here I am loading the graphics module once
   // This is for the sake of example:
   // I'm making the arbitrary decision not to support
   // reloading for this particular module. Otherwise, you should
   // do the import in the "initCommon" function that is also called
   // in onReload, just like the other import done in initCommon
   // the gfx module is saved to state so I can recover it
   // after a reload
   // state.gfx = await MR.dynamicImport(getPath('lib/graphics.js'));
   state.noise = new ImprovedNoise();
   await initCommon(state);

   // (New Info): input state in a sub-object that can be cached
   // for convenience
   // e.g. const input = state.input;
   state.input = {
      turnAngle : 0,
      tiltAngle : 0,
      cursor : ScreenCursor.trackCursor(MR.getCanvas()),
      cursorPrev : [0,0,0],
      LC : null,
      RC : null
   }

   // I propose adding a dictionary mapping texture strings to locations, so that drawShapes becomes clearer
   const images = await imgutil.loadImagesPromise([
      getPath("textures/wood.png"),
      getPath("textures/tiles.jpg"),
      getPath("textures/noisy_bump.jpg")
   ]);

   let libSources = await MREditor.loadAndRegisterShaderLibrariesForLiveEditing(gl, "libs", [
      { key : "pnoise"    , path : "shaders/noise.glsl"     , foldDefault : true },
      { key : "sharedlib1", path : "shaders/sharedlib1.glsl", foldDefault : true },
   ]);
   if (! libSources)
      throw new Error("Could not load shader library");

   function onNeedsCompilationDefault(args, libMap, userData) {
      const stages = [args.vertex, args.fragment];
      const output = [args.vertex, args.fragment];
      const implicitNoiseInclude = true;
      if (implicitNoiseInclude) {
         let libCode = MREditor.libMap.get('pnoise');
         for (let i = 0; i < 2; i++) {
               const stageCode = stages[i];
               const hdrEndIdx = stageCode.indexOf(';');
               const hdr = stageCode.substring(0, hdrEndIdx + 1);
               output[i] = hdr + '\n#line 2 1\n' +
                           '#include<pnoise>\n#line ' + (hdr.split('\n').length + 1) + ' 0' +
                           stageCode.substring(hdrEndIdx + 1);
         }
      }
      MREditor.preprocessAndCreateShaderProgramFromStringsAndHandleErrors(
         output[0],
         output[1],
         libMap
      );
   }

   // load vertex and fragment shaders from the server, register with the editor
   let shaderSource = await MREditor.loadAndRegisterShaderForLiveEditing(
      gl,
      "mainShader",
      {
         // (New Info): example of how the pre-compilation function callback
         // could be in the standard library instead if I put the function defintion
         // elsewhere
         onNeedsCompilationDefault : onNeedsCompilationDefault,
         onAfterCompilation : (program) => {
               gl.useProgram(state.program = program);
               state.uColorLoc    = gl.getUniformLocation(program, 'uColor');
               state.uCursorLoc   = gl.getUniformLocation(program, 'uCursor');
               state.uModelLoc    = gl.getUniformLocation(program, 'uModel');
               state.uProjLoc     = gl.getUniformLocation(program, 'uProj');
               state.uTexScale    = gl.getUniformLocation(program, 'uTexScale');
               state.uTexIndexLoc = gl.getUniformLocation(program, 'uTexIndex');
               state.uTimeLoc     = gl.getUniformLocation(program, 'uTime');
               state.uToonLoc     = gl.getUniformLocation(program, 'uToon');
               state.uViewLoc     = gl.getUniformLocation(program, 'uView');
                     state.uTexLoc = [];
                     for (let n = 0 ; n < 8 ; n++) {
                        state.uTexLoc[n] = gl.getUniformLocation(program, 'uTex' + n);
                        gl.uniform1i(state.uTexLoc[n], n);
                     }
         }
      },
      {
         paths : {
               vertex   : "shaders/vertex.vert.glsl",
               fragment : "shaders/fragment.frag.glsl"
         },
         foldDefault : {
               vertex   : true,
               fragment : false
         }
      }
   );
   if (! shaderSource)
      throw new Error("Could not load shader");

   state.cursor = ScreenCursor.trackCursor(MR.getCanvas());


   state.buffer = gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);

   let bpe = Float32Array.BYTES_PER_ELEMENT;

   let aPos = gl.getAttribLocation(state.program, 'aPos');
   gl.enableVertexAttribArray(aPos);
   gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, bpe * VERTEX_SIZE, bpe * 0);

   let aNor = gl.getAttribLocation(state.program, 'aNor');
   gl.enableVertexAttribArray(aNor);
   gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, bpe * VERTEX_SIZE, bpe * 3);

   let aTan = gl.getAttribLocation(state.program, 'aTan');
   gl.enableVertexAttribArray(aTan);
   gl.vertexAttribPointer(aTan, 3, gl.FLOAT, false, bpe * VERTEX_SIZE, bpe * 6);

   let aUV  = gl.getAttribLocation(state.program, 'aUV');
   gl.enableVertexAttribArray(aUV);
   gl.vertexAttribPointer(aUV , 2, gl.FLOAT, false, bpe * VERTEX_SIZE, bpe * 9);


   for (let i = 0 ; i < images.length ; i++) {
      gl.activeTexture (gl.TEXTURE0 + i);
      gl.bindTexture   (gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D    (gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i]);
      gl.generateMipmap(gl.TEXTURE_2D);
   }

   // (New Info): editor state in a sub-object that can be cached
   // for convenience
   // e.g. const editor = state.editor;
   // state.editor = {
   //     menuShape : [gfx.cube, gfx.sphere, gfx.cylinder, gfx.torus],
   //     objs : [],
   //     menuChoice : -1,
   //     enableModeler : false
   // };

   state.calibrationCount = 0;

   Input.initKeyEvents();

   // load files into a spatial audio context for playback later - the path will be needed to reference this source later
   this.audioContext1 = new SpatialAudioContext([
   'assets/audio/blop.wav'
   ]);

   this.audioContext2 = new SpatialAudioContext([
   'assets/audio/peacock.wav'
   ]);


   /************************************************************************

   Here we show an example of how to create a grabbable object.
   First instatiate object using Obj() constructor, and add the following
   variables. Then send a spawn message. This will allow the server to keep
   track of objects that need to be synchronized.

   ************************************************************************/

   MR.objs.push(grabbableCube);
   grabbableCube.position    = [0,0,-0.5].slice();
   grabbableCube.orientation = [1,0,0,1].slice();
   grabbableCube.uid = 0;
   grabbableCube.lock = new Lock();
   sendSpawnMessage(grabbableCube);
}

/************************************************************************

This is an example of a spawn message we send to the server.

************************************************************************/


function Obj(shape) {
   this.shape = shape;
};

const HALL_WIDTH       = 1.4;
let BLOB_SIZE = .45;
let BLOB_LIFE = 300;
let BIRTH_OFFSET = 150;
let BLOB_COUNT = 4;
let BLOB_COLORS = [
  [1,0,0],
  [0,1,0],
  [0,0,1]
]

let COLOR_TIME = 250;
let CURRENT_COLOR = BLOB_COLORS[0];

function updateColor() {
  CURRENT_COLOR = BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)]
}


function Blob() {
  let position, color, birth, death;
  let setPosition = () => {
    // TODO: ensure that nothing on the ceiling, and on floor?
    // TODO: ensure things are in reach
    let a = Math.random() * HALL_WIDTH - HALL_WIDTH/2;
    let b = Math.random() * HALL_WIDTH - HALL_WIDTH/2;
    let c = Math.random() < 0.5 ? -1 : 1;
    let d = Math.random();
    if(d<0.33) {
      position = [a, b, c*HALL_WIDTH/2];
    } else if (d<0.67) {
      position = [a, c*HALL_WIDTH/2, b];
    } else {
      position = [c*HALL_WIDTH/2, a, b];
    }
  }
  let setColor = () => {
    color = BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)];
  };
  this.makeTouched = () => { color = [0,0,0]; }
  this.getColor = () => { return color };
  this.getPos = () => { return position; };
  this.isAlive = (frame) => { return (frame >= birth && frame < death); }
  this.setup = (currentFrame) => {
    birth = currentFrame + Math.floor(Math.random() * BIRTH_OFFSET) + 1;
    death = birth + BLOB_LIFE;
    // position = [0, HALL_WIDTH/2, 0];
    setPosition();
    setColor();
  }
  // THIS IS NOT WORKING
  this.isTouched = (input) => {
    let lPos = input.LC.tip();
    let rPos = input.RC.tip();
    let touched = (CG.distance(lPos, position) <= BLOB_SIZE || CG.distance(rPos, position) <= BLOB_SIZE);
    return touched;
  }
}

let blobs = [];
for(let i=0;i<BLOB_COUNT; i++) {
  let color = Math.floor(Math.random() * BLOB_COLORS.length);
  let birth = Math.floor(Math.random() * 20);
  let blob = new Blob();
  blob.setup(1);
  blobs.push(blob);
}


function sendSpawnMessage(object){
   const response =
      {
         type: "spawn",
         uid: object.uid,
         lockid: -1,
         state: {
            position: object.position,
            orientation: object.orientation,
         }
      };

   MR.syncClient.send(response);
}

function onStartFrame(t, state) {
   /*-----------------------------------------------------------------
   Also, for my particular use, I have set up a particular transformation
   so that the virtual room would match my physical room, putting the
   resulting matrix into state.calibrate. If you want to do something
   similar, you would need to do a different calculation based on your
   particular physical room.
   -----------------------------------------------------------------*/
   const input  = state.input;
   const editor = state.editor;

   if (! state.avatarMatrixForward) {
      // MR.avatarMatrixForward is because i need accesss to this in callback.js, temp hack
      MR.avatarMatrixForward = state.avatarMatrixForward = CG.matrixIdentity();
      MR.avatarMatrixInverse = state.avatarMatrixInverse = CG.matrixIdentity();
   }

   if (MR.VRIsActive()) {
      if (!input.HS) input.HS = new HeadsetHandler(MR.headset);
      if (!input.LC) input.LC = new ControllerHandler(MR.leftController);
      if (!input.RC) input.RC = new ControllerHandler(MR.rightController);

      if (! state.calibrate) {
         m.identity();
         m.rotateY(Math.PI/2);
         m.translate(-2.01,.04,0);
         state.calibrate = m.value().slice();
      }

      // let avatarIds = Object.keys( MR.avatars);
      // avatarIds.sort();
      // let myId = MR.playerid;
      // let myIndex = avatarIds.indexOf(myId);
      // let nextIndex = (myIndex+1) % avatarIds.length;
      // let nextId = avatarIds[nextIndex];
      // console.log("MYID" + myId);
      // console.log("NEXTID" + nextId);
      //
      // if( MR.avatars[myId].mode == MR.UserType.vr && MR.avatars[nextId].mode == MR.UserType.vr ) {
      //   // let nextRight =  MR.avatars[nextId].rightController;
      //   // let nextLeft =  MR.avatars[nextId].leftController;
      //
      //   MR.avatars[nextId].rightController = MR.avatars[myId].rightController;
      //   MR.avatars[nextId].leftController = MR.avatars[myId].leftController;
      //   console.log("SWAP");
      // }
   }

   if (! state.tStart)
      state.tStart = t;
   state.time = (t - state.tStart) / 1000;

   if(!state.frame) {
     state.frame = 1;
   } else {
     state.frame = state.frame+1;
   }

    // THIS CURSOR CODE IS ONLY RELEVANT WHEN USING THE BROWSER MOUSE, NOT WHEN IN VR MODE.

   let cursorValue = () => {
      let p = state.cursor.position(), canvas = MR.getCanvas();
      return [ p[0] / canvas.clientWidth * 2 - 1, 1 - p[1] / canvas.clientHeight * 2, p[2] ];
   }

   let cursorXYZ = cursorValue();
   if (state.cursorPrev === undefined)
      state.cursorPrev = [0,0,0];
   if (state.turnAngle === undefined)
      state.turnAngle = state.tiltAngle = 0;
   if (cursorXYZ[2] && state.cursorPrev[2]) {
      state.turnAngle -= Math.PI/2 * (cursorXYZ[0] - state.cursorPrev[0]);
      state.tiltAngle += Math.PI/2 * (cursorXYZ[1] - state.cursorPrev[1]);
   }
   state.cursorPrev = cursorXYZ;

   if (state.position === undefined)
      state.position = [0,0,0];
   let fx = -.01 * Math.sin(state.turnAngle),
       fz =  .01 * Math.cos(state.turnAngle);
   if (Input.keyIsDown(Input.KEY_UP)) {
      state.position[0] += fx;
      state.position[2] += fz;
   }
   if (Input.keyIsDown(Input.KEY_DOWN)) {
      state.position[0] -= fx;
      state.position[2] -= fz;
   }

// SET UNIFORMS AND GRAPHICAL STATE BEFORE DRAWING.

   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
   gl.clearColor(0.0, 0.0, 0.0, 1.0);

   gl.uniform3fv(state.uCursorLoc, cursorXYZ);
   gl.uniform1f (state.uTimeLoc  , state.time);

   gl.enable(gl.DEPTH_TEST);
   gl.enable(gl.CULL_FACE);

   if (input.LC) {
      let LP = input.LC.center();
      let RP = input.RC.center();
      let D  = CG.subtract(LP, RP);
      let d  = metersToInches(CG.norm(D));
      let getX = C => {
         m.save();
            m.identity();
            m.rotateQ(CG.matrixFromQuaternion(C.orientation()));
            m.rotateX(.75);
            let x = (m.value())[1];
         m.restore();
         return x;
      }
      let lx = getX(input.LC);
      let rx = getX(input.RC);
      let sep = metersToInches(TABLE_DEPTH - 2 * RING_RADIUS);
      if (d >= sep - 1 && d <= sep + 1 && Math.abs(lx) < .03 && Math.abs(rx) < .03) {
         if (state.calibrationCount === undefined)
            state.calibrationCount = 0;
         if (++state.calibrationCount == 30) {
            m.save();
               m.identity();
               m.translate(CG.mix(LP, RP, .5));
               m.rotateY(Math.atan2(D[0], D[2]) + Math.PI/2);
               m.translate(-2.35,1.00,-.72);
               state.avatarMatrixForward = CG.matrixInverse(m.value());
               state.avatarMatrixInverse = m.value();
            m.restore();
            state.calibrationCount = 0;
         }
      }
   }

   for(let i=0; i<BLOB_COUNT; i++) {
     let b = blobs[i];
     if(input.LC && b.isTouched(input)) {
       b.makeTouched();
       console.log("touched");
     }
     if(!b.isAlive(state.frame)) {
       b.setup(state.frame);
     }
   }

   if(state.frame % COLOR_TIME == 0) {
     updateColor();
   }
    /*-----------------------------------------------------------------
    This function releases stale locks. Stale locks are locks that
    a user has already lost ownership over by letting go
    -----------------------------------------------------------------*/
    releaseLocks(state);
    /*-----------------------------------------------------------------
    This function checks for intersection and if user has ownership over
    object then sends a data stream of position and orientation.
    -----------------------------------------------------------------*/
    pollGrab(state);
}


function onDraw(t, projMat, viewMat, state, eyeIdx) {
   m.identity();
   m.rotateX(state.tiltAngle);
   m.rotateY(state.turnAngle);
   let P = state.position;
   m.translate(P[0],P[1],P[2]);

   viewMat = CG.matrixMultiply(viewMat, state.avatarMatrixInverse);
   gl.uniformMatrix4fv(state.uViewLoc, false, new Float32Array(viewMat));
   gl.uniformMatrix4fv(state.uProjLoc, false, new Float32Array(projMat));

   let prev_shape = null;

   const input  = state.input;

   let drawShape = (shape, color, texture, textureScale) => {
      gl.uniform4fv(state.uColorLoc, color.length == 4 ? color : color.concat([1]));
      gl.uniformMatrix4fv(state.uModelLoc, false, m.value());
      gl.uniform1i(state.uTexIndexLoc, texture === undefined ? -1 : texture);
      gl.uniform1f(state.uTexScale, textureScale === undefined ? 1 : textureScale);
      if (shape != prev_shape)
         gl.bufferData(gl.ARRAY_BUFFER, new Float32Array( shape ), gl.STATIC_DRAW);
      if (state.isToon) {
         gl.uniform1f (state.uToonLoc, .3 * CG.norm(m.value().slice(0,3)));
         gl.cullFace(gl.FRONT);
         gl.drawArrays(shape == CG.cube ? gl.TRIANGLES : gl.TRIANGLE_STRIP, 0, shape.length / VERTEX_SIZE);
         gl.cullFace(gl.BACK);
         gl.uniform1f (state.uToonLoc, 0);
      }
      gl.drawArrays(shape == CG.cube ? gl.TRIANGLES : gl.TRIANGLE_STRIP, 0, shape.length / VERTEX_SIZE);
      prev_shape = shape;
   }

   let drawHeadset = (position, orientation) => {
      //  let P = HS.position();'
      let P = position;

      m.save();
         m.multiply(state.avatarMatrixForward);
         m.translate(P[0],P[1],P[2]);
         m.rotateQ(orientation);
         m.scale(.1);
         m.save();
            m.scale(1,1.5,1);
            drawShape(CG.sphere, [0,0,0]);
         m.restore();
         for (let s = -1 ; s <= 1 ; s += 2) {
            m.save();
               m.translate(s*.4,.2,-.8);
               m.scale(.4,.4,.1);
               drawShape(CG.sphere, [10,10,10]);
            m.restore();
         }
      m.restore();
   }

   let drawController = (C, hand, color) => {
      let P = C.position();
      m.save();
         m.multiply(state.avatarMatrixForward);
         m.translate(P[0],P[1],P[2]);
         m.rotateQ(C.orientation());
         m.translate(0,.02,-.005);
         m.rotateX(.75);
         m.save();
            m.translate(0,0,-.0095).scale(.004,.004,.003);
            drawShape(CG.sphere, C.isDown() ? [10,0,0] : color);
         m.restore();
         m.save();
            m.translate(0,0,-.01).scale(.04,.04,.13);
            drawShape(CG.torus1, color);
         m.restore();
         m.save();
            m.translate(0,-.0135,-.008).scale(.04,.0235,.0015);
            drawShape(CG.cylinder, color);
         m.restore();
         m.save();
            m.translate(0,-.01,.03).scale(.012,.02,.037);
            drawShape(CG.cylinder, color);
         m.restore();
         m.save();
            m.translate(0,-.01,.067).scale(.012,.02,.023);
            drawShape(CG.sphere, color);
         m.restore();
      m.restore();
   }

   let drawSyncController = (pos, rot, color) => {
      let P = pos;
      m.save();
      // m.identity();
         m.translate(P[0], P[1], P[2]);
         m.rotateQ(rot);
         m.translate(0,.02,-.005);
         m.rotateX(.75);
         m.save();
               m.translate(0,0,-.0095).scale(.004,.004,.003);
         m.restore();
         m.save();
               m.translate(0,0,-.01).scale(.04,.04,.13);
               drawShape(CG.torus1, color);
         m.restore();
         m.save();
               m.translate(0,-.0135,-.008).scale(.04,.0235,.0015);
               drawShape(CG.cylinder, color);
         m.restore();
         m.save();
               m.translate(0,-.01,.03).scale(.012,.02,.037);
               drawShape(CG.cylinder, color);
         m.restore();
         m.save();
               m.translate(0,-.01,.067).scale(.012,.02,.023);
               drawShape(CG.sphere, color);
         m.restore();
      m.restore();
   }

   let drawAvatars = () => {

     let avatarIds = Object.keys( MR.avatars);
     avatarIds.sort();

     let cc = 0;

     for (let i=0; i<avatarIds.length; i++) {
        let id = avatarIds[i];
        let nextId = avatarIds[ (i+1) % avatarIds.length ];
        const avatar = MR.avatars[id];
        const nextAvatar = MR.avatars[nextId];
        // console.log("ID " + id + " NEXTID " + nextId);

        if (avatar.mode == MR.UserType.vr && nextAvatar.mode == MR.UserType.vr) {
           let headsetPos = avatar.headset.position;
           let headsetRot = avatar.headset.orientation;
           if(headsetPos == null || headsetRot == null)
              continue;
           if (typeof headsetPos == 'undefined') {
              console.log(id);
              console.log("not defined");
           }

           let nextHeadsetPos = nextAvatar.headset.position;
           let nextHeadsetRot = nextAvatar.headset.position;
           let nextRcontroller = nextAvatar.rightController;
           let nextLcontroller = nextAvatar.leftController;
           let nextRelativeRight = CG.subtract(nextRcontroller.position, nextHeadsetPos);
           let nextRelativeLeft = CG.subtract(nextLcontroller.position, nextHeadsetPos);

           const rcontroller = avatar.rightController;
           const lcontroller = avatar.leftController;

           let rPos = CG.add(headsetPos, nextRelativeRight);
           let lPos = CG.add(headsetPos, nextRelativeLeft);

           m.save();
             m.translate(headsetPos[0], headsetPos[1], headsetPos[2]);
             m.save();
               m.rotateQ(headsetRot);
               m.scale(0.1,0.1,0.1);
               m.save();
                 drawShape(CG.cylinder, [0.2+cc,0.2+cc,0.4+cc]);
               m.restore();
             m.restore();
             m.save();
               // NEED TO ROTATE WITH THE DIFFERENCE IN HEADSET ROTATIONS
               // m.rotateQ(headsetRot);
               // m.rotateQ(-nextHeadsetRot);
               drawSyncController(rPos, rcontroller.orientation, CURRENT_COLOR);
               drawSyncController(lPos, lcontroller.orientation, CURRENT_COLOR);
             m.restore();
           m.restore();
        }
        cc+=0.2;
     }
   }

   if (input.LC) {
      let P = state.position;
      m.translate(-P[0],-P[1],-P[2]);
      m.rotateY(-state.turnAngle);
      m.rotateX(-state.tiltAngle);
      // drawController(input.LC, 0, CURRENT_COLOR);
      // drawController(input.RC, 1, CURRENT_COLOR);
   }

   // m.translate(0, HALL_WIDTH/2-EYE_HEIGHT, 0);
   m.save();
      m.scale(-HALL_WIDTH/2, -HALL_WIDTH/2, -HALL_WIDTH/2);
      drawShape(CG.cube, [1,1,1]);
   m.restore();

   for(let i=0; i<BLOB_COUNT; i++) {
     let b = blobs[i];
     if(b.isAlive(state.frame)) {
       let p = b.getPos();
       m.save();
        m.translate(p[0], p[1], p[2]);
        m.scale(BLOB_SIZE, BLOB_SIZE, BLOB_SIZE);
        drawShape(CG.sphere, b.getColor());
       m.restore();
     }
   }

   drawAvatars();

  //  m.save();
  //   m.translate(0,0,-0.3);
  //   m.scale(0.5,0.5,0.5);
  //   drawAvatars();
  // m.restore();


}

function onEndFrame(t, state) {
   pollAvatarData();
   const input  = state.input;
   if (input.LC) input.LC.onEndFrame();
   if (input.RC) input.RC.onEndFrame();
}

export default function main() {
   const def = {
      name: 'YOUR_NAME_HERE week10',
      setup: setup,
      onStartFrame: onStartFrame,
      onEndFrame: onEndFrame,
      onDraw: onDraw,

      // (New Info): New callbacks:

      // VR-specific drawing callback
      // e.g. for when the UI must be different
      //      in VR than on desktop
      //      currently setting to the same callback as on desktop
      onDrawXR: onDraw,
      // call upon reload
      onReload: onReload,
      // call upon world exit
      onExit: onExit
   };

   return def;
}


//////////////EXTRA TOOLS

// A better approach for this would be to define a unit sphere and
// apply the proper transform w.r.t. corresponding grabbable object

function checkIntersection(point, verts) {
   const bb = calcBoundingBox(verts);
   const min = bb[0];
   const max = bb[1];

   if (point[0] > min[0] && point[0] < max[0] &&
      point[1] > min[1] && point[1] < max[1] &&
      point[2] > min[2] && point[2] < max[2]) return true;

   return false;
}

// see above

function calcBoundingBox(verts) {
   const min = [Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE];
   const max = [Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE];

   for(let i = 0; i < verts.length; i+=2){

      if(verts[i] < min[0]) min[0] = verts[i];
      if(verts[i+1] < min[1]) min[1] = verts[i+1];
      if(verts[i+2] < min[2]) min[2] = verts[i+2];

      if(verts[i] > max[0]) max[0] = verts[i];
      if(verts[i+1] > max[1]) max[1] = verts[i+1];
      if(verts[i+2] > max[2]) max[2] = verts[i+2];
   }

   return [min, max];
}

function pollGrab(state) {
   let input = state.input;
   if ((input.LC && input.LC.isDown()) || (input.RC && input.RC.isDown())) {

      let controller = input.LC.isDown() ? input.LC : input.RC;
      for (let i = 0; i < MR.objs.length; i++) {
         //ALEX: Check if grabbable.
         let isGrabbed = checkIntersection(controller.position(), MR.objs[i].shape);
         //requestLock(MR.objs[i].uid);
         if (isGrabbed == true) {
            if (MR.objs[i].lock.locked) {
               MR.objs[i].position = controller.position();
               const response =
               {
                  type: "object",
                  uid: MR.objs[i].uid,
                  state: {
                     position: MR.objs[i].position,
                     orientation: MR.objs[i].orientation,
                  },
                  lockid: MR.playerid,

               };

               MR.syncClient.send(response);
            } else {
               MR.objs[i].lock.request(MR.objs[i].uid);
            }
         }
      }
   }
}

function releaseLocks(state) {
   let input = state.input;
   if ((input.LC && !input.LC.isDown()) && (input.RC && !input.RC.isDown())) {
      for (let i = 0; i < MR.objs.length; i++) {
         if (MR.objs[i].lock.locked == true) {
            MR.objs[i].lock.locked = false;
            MR.objs[i].lock.release(MR.objs[i].uid);
         }
      }
   }
}
