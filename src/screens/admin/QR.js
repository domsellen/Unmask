import React, { Component } from 'react';
import { connect } from "react-redux";
import { startEnroll } from '../../actions';

import FooterBtn from '../../components/FooterBtn';
import Header from '../../components/Header';

class QR extends Component {
  render() {
    return (
      <div className='content'>
        <Header back='true' />
        <div className='container bgWhite'>
          <p>Link: https://www.unmask.firebase.com?game={this.props.gameExists} </p>
        </div>
        <FooterBtn text="Let people enroll" click={() => this.props.startEnroll()} />
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    gameExists: state.general.gameExists
  };
}

export default connect(mapStateToProps, { startEnroll })(QR);
