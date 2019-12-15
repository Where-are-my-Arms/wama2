'use strict';

/**
 * Below part copied from week10.js, should have better way to share them
 */

const RANDOM = 100;
const FIXED = 101;

const HALL_WIDTH = 1.4;
let BLOB_SIZE = .1;
let BLOB_LIFE = 700;
let BIRTH_OFFSET = 5000;
let BLOB_COUNT = 15;
let BLOB_COLORS = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
]

function Blob() {
    let uid, position, color, birth, death, wasTouched, revived, mode;

    let randomPosition = () => {
        let pos;
        let a = Math.random() * HALL_WIDTH - HALL_WIDTH / 2;
        let b = Math.random() * HALL_WIDTH - HALL_WIDTH / 2;
        let c = Math.random() < 0.5 ? -1 : 1;
        let d = Math.random();

        //position = [0,-HALL_WIDTH/2, 0];	
        if (d < 0.33) {
            pos = [a, b, c * HALL_WIDTH / 2];
        } else if (d < 0.67) {
            pos = [a, c * HALL_WIDTH / 2, b];
        } else {
            pos = [c * HALL_WIDTH / 2, a, b];
        }
        return pos
    };
    let fixedPositions = (nx, ny, nz) => {
        // nx, ny, nz are the number of blobs you want in each direction
        let pos;
        let x = nx + 1;
        let y = ny + 1;
        let z = nz + 1;

        let dx = HALL_WIDTH / x;
        let dy = HALL_WIDTH / y;
        let dz = HALL_WIDTH / z;

        let ix = Math.floor(Math.random() * nx) + 1;
        let iy = Math.floor(Math.random() * ny) + 1;
        let iz = Math.floor(Math.random() * nz) + 1;

        let px = ix * dx - (HALL_WIDTH / 2);
        let py = iy * dy - HALL_WIDTH;
        let pz = iz * dz - (HALL_WIDTH / 2);
        pos = [px, py, pz];
        //console.log([dx, dy, dz]);
        //console.log([0,-HALL_WIDTH / 2, 0]);
        //console.log(pos);
        return pos;
    };

    let setPosition = () => {
        // TODO: ensure that nothing on the ceiling, and on floor?
        // TODO: ensure things are in reach
        switch (mode) {
            case RANDOM:
                position = randomPosition();
                break;
            case FIXED:
                position = fixedPositions(3, 3, 3);
                break;
            default:
                position = fixedPositions(3, 3, 3);
        }
    }
    let setColor = () => {
        color = BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)];
    };

    this.load = (uidOri, positionOri, colorOri, birthOri, deathOri, wasTouchedOri, revivedOri, modeOri) => {
        uid = uidOri;
        position = positionOri;
        color = colorOri;
        birth = birthOri;
        death = deathOri;
        wasTouched = wasTouchedOri;
        revived = revivedOri;
        mode = modeOri;
    }

    this.makeTouched = () => {
        color = [0, 0, 0];
        wasTouched = true;
    }

    this.getUid = () => { return uid };
    this.getColor = () => { return color };
    this.getPos = () => { return position };
    this.getBirth = () => { return birth };
    this.getDeath = () => { return death };
    this.getWasTouched = () => { return wasTouched };
    this.getRevived = () => { return revived };
    this.getMode = () => { return mode };

    this.setUid = (uidOri) => { uid = uidOri }
    this.isAlive = (frame) => { return (frame >= birth && frame < death); };
    this.kill = (currentFrame) => {
        death = currentFrame + 50;
    };
    this.revived = () => { return revived; };
    this.setRevived = () => { revived = true; };
    this.setNotRevived = () => { revived = false; };
    this.setup = (currentFrame) => {
        birth = currentFrame + Math.floor(Math.random() * BIRTH_OFFSET) + 1;
        death = birth + BLOB_LIFE;
        wasTouched = false;
        mode = FIXED;
        // position = [0, HALL_WIDTH/2, 0];
        setPosition();
        setColor();
    }
    this.wasTouched = () => {
        return wasTouched;
    };
    // THIS IS NOT WORKING
    this.isTouched = (input) => {
        let lPos = input.LC.tip();
        let rPos = input.RC.tip();
        // let touched = (CG.distance(lPos, position) <= BLOB_SIZE || CG.distance(rPos, position) <= BLOB_SIZE);
        let touched = (CG.distance(rPos, position) <= BLOB_SIZE);
        return touched;
    }
    this.isValid = () => { return (color[0] == CURRENT_COLOR[0] && color[1] == CURRENT_COLOR[1] && color[1] == CURRENT_COLOR[1]); };
}

/**
 * Above part copied from week10.js, should have better way to share them
 */

MR.syncClient.eventBus.subscribe("platform", (json) => {

});

MR.syncClient.eventBus.subscribe("initialize", (json) => {

    if (!MR.avatars) {
        MR.avatars = {};
    }

    const id = json["id"];

    let headset = new Headset(CG.cylinder);
    let leftController = new Controller(CG.cube);
    let rightController = new Controller(CG.cube);
    let playerAvatar = new Avatar(headset, id, leftController, rightController);

    for (let key in json["avatars"]) {
        const avid = json["avatars"][key]["user"];
        let avatar = new Avatar(headset, avid, leftController, rightController);
        MR.avatars[avid] = avatar;
    }

    // MR.avatars[id] = playerAvatar;
    MR.playerid = id;
    console.log("player id is", id);
    console.log(MR.avatars);
});

MR.syncClient.eventBus.subscribe("join", (json) => {
    console.log(json);
    const id = json["id"];

    if (id in MR.avatars) {

    } else {
        let headset = new Headset(CG.cylinder);
        let leftController = new Controller(CG.cube);
        let rightController = new Controller(CG.cube);
        let avatar = new Avatar(headset, id, leftController, rightController);
        MR.avatars[id] = avatar;
    }

    console.log(MR.avatars);

    MR.updatePlayersMenu();
});

MR.syncClient.eventBus.subscribe("leave", (json) => {
    console.log(json);
    delete MR.avatars[json["user"]];

    MR.updatePlayersMenu();
});

MR.syncClient.eventBus.subscribe("tick", (json) => {
    // console.log("world tick: ", json);
});

MR.syncClient.eventBus.subscribe("avatar", (json) => {
    //if (MR.VRIsActive()) {
    const payload = json["data"];
    //console.log(json);
    //console.log(payload);
    for (let key in payload) {
        //TODO: We should not be handling visible avatars like this.
        //TODO: This is just a temporary bandaid.
        if (payload[key]["user"] in MR.avatars && payload[key]["state"]["mode"] == MR.UserType.vr) {
            MR.avatars[payload[key]["user"]].headset.position = payload[key]["state"]["pos"];
            MR.avatars[payload[key]["user"]].headset.orientation = payload[key]["state"]["rot"];
            //console.log(payload[key]["state"]);
            MR.avatars[payload[key]["user"]].leftController.position = payload[key]["state"].controllers.left.pos;
            MR.avatars[payload[key]["user"]].leftController.orientation = payload[key]["state"].controllers.left.rot;
            MR.avatars[payload[key]["user"]].rightController.position = payload[key]["state"].controllers.right.pos;
            MR.avatars[payload[key]["user"]].rightController.orientation = payload[key]["state"].controllers.right.rot;
            MR.avatars[payload[key]["user"]].mode = payload[key]["state"]["mode"];
        } else {
            // never seen, create
            //ALEX: AVATARS WHO ARE ALSO IN BROWSER MODE GO HERE...
            //console.log("previously unseen user avatar");
            // let avatarCube = createCubeVertices();
            // MR.avatars[payload[key]["user"]] = new Avatar(avatarCube, payload[key]["user"]);
        }
    }
    //}
});

/*
// expected format of message
const response = {
    "type": "lock",
    "uid": key,
    "success": boolean
};

 */

// TODO:
// deal with logic and onlock
MR.syncClient.eventBus.subscribe("lock", (json) => {

    const success = json["success"];
    const key = json["uid"];

    if (success) {
        console.log("acquire lock success: ", key);
        MR.objs[key].lock.locked = true;
    } else {
        console.log("acquire lock failed : ", key);
    }

});

/*
// expected format of message
const response = {
        "type": "release",
        "uid": key,
        "success": boolean
};

 */

// TODO:
// deal with logic and onlock
MR.syncClient.eventBus.subscribe("release", (json) => {

    const success = json["success"];
    const key = json["uid"];

    if (success) {
        console.log("release lock success: ", key);
    } else {
        console.log("release lock failed : ", key);
    }

});

/*
//on success:

const response = {
    "type": "object",
    "uid": key,
    "state": json,
    "lockid": lockid,
    "success": true
};

//on failure:

const response = {
    "type": "object",
    "uid": key,
    "success": false
};
*/

// TODO:
// update to MR.objs
/*
MR.syncClient.eventBus.subscribe("object", (json) => {

    const success = json["success"];

    if (success) {
        console.log("object moved: ", json);
        // update MR.objs
    } else {
        console.log("failed object message", json);
    }

});*/

// TODO:
// add to MR.objs
MR.syncClient.eventBus.subscribe("spawn", (json) => {

    const success = json["success"];

    if (success) {
        console.log("object created ", json);
        // add to MR.objs
    } else {
        console.log("failed spawn message", json);
    }

});

// Response to sendSpawnBlobMessage from client side
MR.syncClient.eventBus.subscribe("spawnBlob", (json) => {

    const success = json["success"];

    if (success) {
        let uid = "" + json["uid"];
        let pos = [json["state"]["position"][0], json["state"]["position"][1], json["state"]["position"][2]];
        let color = [json["state"]["color"][0], json["state"]["color"][1], json["state"]["color"][2]];
        let birth = json["state"]["birth"];
        let death = json["state"]["death"];
        let wasTouched = json["state"]["wasTouched"];
        let revived = json["state"]["revived"];
        let mode = json["state"]["mode"];

        let blob = new Blob();
        blob.load(uid, pos, color, birth, death, wasTouched, revived, mode);
        const key = parseInt(uid.substring(4));
        MR.blobs[key] = blob;
    } else {
        console.log("failed spawn message", json);
    }

});

MR.syncClient.eventBus.subscribe("object", (json) => {
    const success = json["success"];
    if (success) {
        console.log("object moved: ", json);
        // update update metadata for next frame's rendering
        let current = MR.objs[json["uid"]];
        console.log(json);
        current.position = [json["state"]["position"][0], json["state"]["position"][1], json["state"]["position"][2]];
        //current.orientation = MR.objs[json["state"]["orientation"]];
    }
    else {
        console.log("failed object message", json);
    }
});

MR.syncClient.eventBus.subscribe("updateBlob", (json) => {

    const success = json["success"];

    if (success) {
        let blob = new Blob();

        let uid = "" + json["uid"];
        let pos = [json["state"]["position"][0], json["state"]["position"][1], json["state"]["position"][2]];
        let color = [json["state"]["color"][0], json["state"]["color"][1], json["state"]["color"][2]];
        let birth = json["state"]["birth"];
        let death = json["state"]["death"];
        let wasTouched = json["state"]["wasTouched"];
        let revived = json["state"]["revived"];
        let mode = json["state"]["mode"];
        blob.load(uid, pos, color, birth, death, wasTouched, revived, mode);

        const key = parseInt(uid.substring(4));
        MR.blobs[key] = blob;
    } else {
        console.log("failed update message", json);
    }

});

// on success
// const response = {
//   "type": "calibrate",
//   "x": ret.x,
//   "z": ret.z,
//   "theta": ret.theta,
//   "success": true
// };

// on failure:
//   const response = {
//     "type": "calibrate",
//     "success": false
// };

MR.syncClient.eventBus.subscribe("calibration", (json) => {
    console.log("world tick: ", json);
});


function pollAvatarData() {
    if (MR.VRIsActive()) {
        const frameData = MR.frameData();
        if (frameData != null) {
            //User Headset
            // const leftInverseView = CG.matrixInverse(frameData.leftViewMatrix);
            // const rightInverseView = CG.matrixInverse(frameData.rightViewMatrix);

            // const leftHeadsetPos = CG.matrixTransform(leftInverseView, frameData.pose.position);
            // const rightHeadsetPos = CG.matrixTransform(rightInverseView, frameData.pose.position);
            // const headsetPos = CG.mix(leftHeadsetPos, rightHeadsetPos);
            // console.log(headsetPos);
            const headsetPos = frameData.pose.position;
            const headsetRot = frameData.pose.orientation;
            const headsetTimestamp = frameData.timestamp;

            if (MR.controllers[0] != null && MR.controllers[1] != null) {
                //Controllers
                const controllerRight = MR.controllers[0];
                const controllerRightPos = controllerRight.pose.position;
                const controllerRightRot = controllerRight.pose.orientation;
                const controllerRightButtons = controllerRight.buttons;

                const controllerLeft = MR.controllers[1];
                const controllerLeftPos = controllerLeft.pose.position;
                const controllerLeftRot = controllerLeft.pose.orientation;
                const controllerLeftButtons = controllerLeft.buttons;

                //buttons have a 'pressed' variable that is a boolean.
                /*A quick mapping of the buttons:
                        0: analog stick
                        1: trigger
                        2: side trigger
                        3: x button
                        4: y button
                        5: home button
                */
                const avatar_message = {
                    type: "avatar",
                    user: MR.playerid,
                    state: {
                        mode: MR.UserType.vr,
                        pos: CG.matrixTransform(MR.avatarMatrixInverse, headsetPos),
                        rot: headsetRot,
                        controllers: {
                            left: {
                                pos: CG.matrixTransform(MR.avatarMatrixInverse, [controllerLeftPos[0], controllerLeftPos[1], controllerLeftPos[2]]),
                                rot: [controllerLeftRot[0], controllerLeftRot[1], controllerLeftRot[2], controllerLeftRot[3]],
                                analog: controllerLeftButtons[0].pressed,
                                trigger: controllerLeftButtons[1].pressed,
                                sideTrigger: controllerLeftButtons[2].pressed,
                                x: controllerLeftButtons[3].pressed,
                                y: controllerLeftButtons[4].pressed,
                                home: controllerLeftButtons[5].pressed,
                                analogx: controllerLeft.axes[0],
                                analogy: controllerLeft.axes[1]

                            },
                            right: {
                                pos: CG.matrixTransform(MR.avatarMatrixInverse, [controllerRightPos[0], controllerRightPos[1], controllerRightPos[2]]),
                                rot: [controllerRightRot[0], controllerRightRot[1], controllerRightRot[2], controllerRightRot[3]],
                                analog: controllerRightButtons[0].pressed,
                                trigger: controllerRightButtons[1].pressed,
                                sideTrigger: controllerRightButtons[2].pressed,
                                x: controllerRightButtons[3].pressed,
                                y: controllerRightButtons[4].pressed,
                                home: controllerRightButtons[5].pressed,
                                analogx: controllerRight.axes[0],
                                analogy: controllerRight.axes[1],
                            }
                        }
                    }
                }

                if (MR.playerid == -1) {
                    return;
                }

                try {
                    //console.log(avatar_message);
                    MR.syncClient.send(avatar_message);
                } catch (err) {
                    console.log(err);
                }
            }

        }

    } else {
        let avatar_message = {
            type: "avatar",
            user: MR.playerid,
            state: {
                mode: MR.UserType.browser,
            }
        }
        try {
            //console.log(avatar_message);
            MR.syncClient.send(avatar_message);
        } catch (err) {
            console.log(err);
        }
    }
}