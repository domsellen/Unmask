import { GAME_EXISTS, LOGIN_USER, LOGOUT_USER, LOADING, GAME_STATUS, SCORE_STATUS, UPDATE_USER } from './types.js';
import * as firebase from "firebase";

export function setGame(gameCode) {
  return function(dispatch) {
    dispatch({ type: GAME_EXISTS, payload: gameCode });
  }
}

export const login = (user) => (dispatch, getState) => {
  firebase.database().ref(getState().exists.game + '/people/' + user.uid).once('value')
  .then(snapshot => snapshot.val()).then(val => {
    console.log("value", val);
    if(val) {
      dispatch({
        type: LOGIN_USER,
        user: val,
        loggedIn: true,
      });
    } else {
      let params = {
        id: user.uid,
        admin: false,
        fbPhotoUrl: user.photoURL,
        name: user.displayName,
        family: '',
        selfieUrl: '',
        targettedBy: [],
        alive: true,
        targets: [
          {
            uid: user.uid,
            word: '',
            success: false
          }
        ],
      }
      firebase.database().ref('/' + getState().exists.game + '/people/' + user.uid).update(params);
      dispatch({
        type: LOGIN_USER,
        user: params,
        loggedIn: true,
      });
    }
  })

  firebase.database().ref('/' + getState().exists.game + '/people/' + user.uid).on('value', (snapshot) => {
    dispatch({ type: UPDATE_USER, payload: snapshot.val() })
  });
};

export const logout = () => (dispatch) => {
  firebase.auth().signOut().then(function() {
    dispatch({
      type: LOGOUT_USER,
      loggedIn: false,
    });
  }).catch(function(error) { console.log(error) });
}

export function stopLoading() {
  return function(dispatch) {
    dispatch({ type: LOADING, payload: false });
  }
}

export function uploadSelfie(upload) {
  return function(dispatch, getState) {
    let userId = getState().data.user.id

    // Storing in user folder in picture folder
    firebase.storage().ref(getState().exists.game + '/' + userId).put(upload)
      .then(function(snapshot) {
        firebase.storage().ref(getState().exists.game).child('/' + userId).getDownloadURL().then(function(selfieUrl) {
          firebase.database().ref(getState().exists.game + '/people/' + userId).child('selfieUrl').set(selfieUrl);
        }).catch(function(error) {console.log(error) });
      }).catch(function(error) {console.log(error) });
  }
}
export function registerGame() {
  return function(dispatch, getState) {
    let userId = getState().data.user.id;
    firebase.database().ref(getState().exists.game + '/people/' + userId).child('enrolled').set(true);
  }
}
export function gameStatus(status) {
  return function(dispatch) {
    dispatch({ type: GAME_STATUS, payload: status });
  }
}
export function scoreStatus(score) {
  return function(dispatch) {
    dispatch({ type: SCORE_STATUS, payload: score });
  }
}
export function updateUser(user) {
  return function(dispatch) {
    dispatch({ type: UPDATE_USER, payload: user });
  }
}

export function startGame(start) {
  return function(dispatch, getState) {
    let game = getState().exists.game;
    // Assign to a family
    firebase.database().ref('/'+ game + '/').once('value').then(function(snapshot) {
      const peopleData = snapshot.val().people;
      const wordsData = snapshot.val().words;

      // convert stupid firebase objects to normal array
      const wordsArray = Object.keys(wordsData).map((key) => wordsData[key])
      const allPeopleArray = Object.keys(peopleData).map((key) => peopleData[key])

      //array only with enrolled people
      const peopleArray = [];
      allPeopleArray.map(person => {
        if(person.enrolled) {
          peopleArray.push(person);
        }
      })

      // randomize array with people
      const randArray = peopleArray.sort((a, b) => {return 0.5 - Math.random()});
      let capuletsScore = 0;
      let montaguesScore = 0;
      for(let i = 0; i < randArray.length; i++) {
        let selectedID = randArray[i].id;
        let target = {
          success: false,
          uid: '',
          name: '',
          word: '',
          selfieUrl: ''
        }

        // even and odd people
        let family = ''
        if(i % 2 === 0) {
          family = 'capulet'
          capuletsScore++;

          // if odd amount of people: last capulet has no target, give them first montague again
          randArray[i+1] ? target.uid = randArray[i+1].id : target.uid = randArray[1].id;

        } else {
          // if index is odd: montague
          family = 'montague'
          montaguesScore++;

          target.uid = randArray[i-1].id;
        }
        firebase.database().ref('/'+ game + '/people/' + selectedID + '/family').set(family);
        firebase.database().ref('/'+ game + '/people/' + selectedID + '/alive').set(true);
        // target word is random from array + add photo from target
        target.word = wordsArray[Math.floor(Math.random()*wordsArray.length)];
        target.selfieUrl = peopleData[target.uid].selfieUrl;
        target.name = peopleData[target.uid].name;

        // set target
        firebase.database().ref('/'+ game + '/people/' + selectedID ).child("targets").set({0: target});
        firebase.database().ref('/'+ game + '/people/' + target.uid ).child("targettedBy").set({ 0: selectedID});
        // set score for capulets and montagues;
        let score = { 'capulet': capuletsScore, 'montague': montaguesScore };
        firebase.database().ref('/'+ game + '/score').set(score);

        // let the games begin! (aka game = true)
        firebase.database().ref('/' + game + '/').child("game").set(true);
      }
    })
  }
}

export function stopGame() {
  return function(dispatch, getState) {
    firebase.database().ref('/' + getState().exists.game + '/').child("game").set(false);
    dispatch({ type: GAME_STATUS, payload: false });
  }
}

export function iDied(uid) {
  return function(dispatch, getState) {
    let game = getState().exists.game
    firebase.database().ref("/" + game).once('value').then(c => c.val()).then(snapshot => {
      const people = snapshot.people;
      const allPeopleArray = Object.keys(people).map((key) => people[key])
      const words = snapshot.words;
      const wordsArray = Object.keys(words).map((key) => words[key])
      const loser = people[uid];
      const family = loser.family;
      const targets = loser.targets;
      const winnerIds = loser.targettedBy;
      let scoreFamily = snapshot.score[family];

      //array only with enrolled people
      const peopleArray = [];
      allPeopleArray.map(person => {
        if(person.enrolled) {
          peopleArray.push(person);
        }
      })

      // *** Herbereken totals
      scoreFamily = scoreFamily - 1;
      firebase.database().ref("/" + game + "/score").child(family).set(scoreFamily);


      // if family = 0, no new target needed
      if (scoreFamily != 0) {
        // Remove loser from targettedBy list  --> loser can not target anymore.
        targets.forEach(element => {
          if(element.success === false) {
            let targetId = element.uid;
            let targettedByArray = people[targetId].targettedBy;
            let targettedByIndex = targettedByArray.findIndex(element => {return element = uid});

            // remove targettedBy loser from his target
            firebase.database().ref("/" + game + "/people/" + targetId + '/targettedBy').remove(targettedByIndex);
          }
        })
        // Winner: success on true + new target & word + add to targettedBy new target
        winnerIds.forEach(winnerId => {
          // Winner = nieuw target + woord
          // Find first person with least amount of targettedBy + alive + same family as former target
          let newTargetPerson = ""
          peopleArray.find(person => {
            if(!person.targettedBy && person.alive === true && person.family === family && person.id != loser.id) {
              newTargetPerson = person;
            } else {
              let leastTargettedBy = 1;
              do {
                newTargetPerson = peopleArray.find(person => {
                  return person.targettedBy.length === leastTargettedBy && person.alive === true && person.family === family && person.id != loser.id;
                });
                leastTargettedBy++;
              }
              while (newTargetPerson == "");
            }
            // Find which target is the loser
            let loserIndex = people[winnerId].targets.findIndex(index => { return index.uid === uid })
            // Every winner gets loser success on true
            firebase.database().ref("/" + game + "/people/" + winnerId + '/targets/' + loserIndex ).child("success").set(true);
          })
          // Random word
          let newWord = wordsArray[Math.floor(Math.random()*wordsArray.length)];
          // Every winner gets new target
          let newTarget = {
            success: false,
            uid: newTargetPerson.id,
            name: newTargetPerson.name,
            word: newWord,
            selfieUrl: newTargetPerson.selfieUrl
          }
          // length of targetlist?
          let lengthTargets = people[winnerId].targets.length;

          firebase.database().ref("/" + game + "/people/" + winnerId + "/targets").child(lengthTargets).set(newTarget);
          // Add winner to targettedBy newTarget
          let lengthTargets2 = people[newTargetPerson.id].targets.length;
          firebase.database().ref("/" + game + "/people/" + newTargetPerson.id + '/targettedBy').child(lengthTargets2).set(winnerId);
        })
      }


      // Alive: false
      firebase.database().ref("/" + game + "/people/" + uid ).child("alive").set(false);

    })
  }
}
