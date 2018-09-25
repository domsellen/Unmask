import { LOGIN_USER, LOADING, GAME_STATUS, SCORE_STATUS, USER_STATUS } from './types.js';
import * as firebase from "firebase";

const game = "CodeCapulets"

export const login = (user) => (dispatch, ownProps) => {
  let params = {
    id: user.uid,
    admin: false,
    fbPhotoUrl: user.photoURL,
    name: user.displayName,
    family: '',
    targettedBy: [],
    alive: true,
    targets: [
      {uid: user.uid,
      word: '',
      success: false
      }
    ],
  }
  firebase.database().ref('/CodeCapulets/people/' + user.uid).once('value')
  .then(function(snapshot) {
    if (snapshot.val() !== null) {
      dispatch({
        type: LOGIN_USER,
        user: snapshot.val(),
        loggedIn: true,
      });
    } else {
      firebase.database().ref('/CodeCapulets/people/' + user.uid).update(params);
      dispatch({
        type: LOGIN_USER,
        user: params,
        loggedIn: true,
      });
    }
  })
};

export function stopLoading() {
  return function(dispatch) {
    dispatch({
      type: LOADING,
      payload: false
    });
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
export function userStatus(status) {
  return function(dispatch) {
    dispatch({ type: USER_STATUS, payload: status });
  }
}

export function startGame(start) {
  return function(dispatch) {
    // Assign to a family
    firebase.database().ref('/'+ game + '/').once('value').then(function(snapshot) {
      const peopleData = snapshot.val().people;
      const wordsData = snapshot.val().words;

      // convert stupid firebase objects to normal array
      const peopleArray = Object.keys(peopleData).map((key) => peopleData[key])
      const wordsArray = Object.keys(wordsData).map((key) => wordsData[key])

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
          fbPhotoUrl: ''
        }

        // even and odd people
        if(i % 2 == 0) {
          firebase.database().ref('/CodeCapulets/people/' + selectedID + '/family').set('capulet');
          capuletsScore++;

          // if odd amount of people: last capulet has no target, give them first montague again
          randArray[i+1] ? target.uid = randArray[i+1].id : target.uid = randArray[1].id;

        } else {
          // if index is odd: montague
          firebase.database().ref('/CodeCapulets/people/' + selectedID + '/family').set('montague');
          montaguesScore++;

          target.uid = randArray[i-1].id;
        }
        firebase.database().ref('/CodeCapulets/people/' + selectedID + '/alive').set(true);
        // target word is random from array + add photo from target
        target.word = wordsArray[Math.floor(Math.random()*wordsArray.length)];
        target.fbPhotoUrl = peopleData[target.uid].fbPhotoUrl;
        target.name = peopleData[target.uid].name;

        // set target
        firebase.database().ref('/CodeCapulets/people/' + selectedID ).child("targets").set({0: target});
        firebase.database().ref('/CodeCapulets/people/' + target.uid ).child("targettedBy").set({ 0: selectedID});
        console.log(peopleData[selectedID].family + ' ' + peopleData[selectedID].name + ' vs ' + peopleData[peopleData[selectedID].targets[0].uid].family + ' ' + peopleData[peopleData[selectedID].targets[0].uid].name)
        // set score for capulets and montagues;
        let score = { 'capulet': capuletsScore, 'montague': montaguesScore };
        firebase.database().ref('/CodeCapulets/score').set(score);

        // let the games begin! (aka game = true)
        firebase.database().ref('/CodeCapulets/').child("game").set(true);
      }
    })
  }
}

export function stopGame() {
  firebase.database().ref('/CodeCapulets/').child("game").set(false);
  return function(dispatch) {
    dispatch({ type: GAME_STATUS, payload: false });
  }
}

export function iDied(uid) {
  return function(dispatch) {
    firebase.database().ref("/" + game).once('value').then(c => c.val()).then(snapshot => {
      const people = snapshot.people;
      const peopleArray = Object.keys(people).map((key) => people[key])
      const words = snapshot.words;
      const wordsArray = Object.keys(words).map((key) => words[key])
      const loser = people[uid];
      const family = loser.family;
      const targets = loser.targets;
      const winnerIds = loser.targettedBy;
      let scoreFamily = snapshot.score[family];

      // *** Herbereken totals
      scoreFamily = scoreFamily - 1;
      firebase.database().ref("/" + game + "/score").child(family).set(scoreFamily);

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
          if(!person.targettedBy && person.alive === true && person.family === family) {
            newTargetPerson = person;
          } else {
            let leastTargettedBy = 1;
            do {
              newTargetPerson = peopleArray.find(person => {
                return person.targettedBy.length === leastTargettedBy && person.alive === true && person.family === family ;
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
          fbPhotoUrl: newTargetPerson.fbPhotoUrl
        }

        // length of targetlist?
        let lengthTargets = people[winnerId].targets.length;
        firebase.database().ref("/" + game + "/people/" + winnerId + "/targets").child(lengthTargets).set(newTarget);

        // Add winner to targettedBy newTarget
        let lengthTargets2 = people[newTargetPerson.id].targets.length;
        firebase.database().ref("/" + game + "/people/" + newTargetPerson.id + '/targettedBy').child(lengthTargets2).set(winnerId);
      })

      // Alive: false
      firebase.database().ref("/" + game + "/people/" + uid ).child("alive").set(false);

    })
  }
}
