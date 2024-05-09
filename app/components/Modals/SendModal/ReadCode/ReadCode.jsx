// @flow
import React from 'react'
import classNames from 'classnames'
import { type ProgressState } from 'spunky'
import { FormattedMessage } from 'react-intl'

import GridIcon from 'assets/icons/grid.svg'
import CozDonationQrCode from 'assets/images/coz-donation-qr-code.png'
import Button from '../../../Button'
import QrCodeScanner from '../../../QrCodeScanner'

import baseStyles from '../SendModal.scss'
import styles from './ReadCode.scss'

type Props = {
  callback: string => any,
  callbackProgress: ProgressState,
  cameraAvailable: boolean,
}

type State = {
  scannerActive: boolean,
}

export default class ReadCode extends React.Component<Props, State> {
  state = {
    scannerActive: false,
  }

  toggleScanner = () => {
    this.setState(prevState => ({ scannerActive: !prevState.scannerActive }))
  }

  getScanner = () => {
    if (this.state.scannerActive) {
      const { callback, callbackProgress } = this.props
      return (
        <QrCodeScanner
          callback={callback}
          callbackProgress={callbackProgress}
          width="352"
          height="220"
        />
      )
    }

    return <img src={CozDonationQrCode} alt="coz-donation-qr-code.png" />
  }

  render() {
    const { cameraAvailable } = this.props
    const { scannerActive } = this.state

    return (
      <div className={baseStyles.contentContainer}>
        <div className={baseStyles.header}>
          <GridIcon className={baseStyles.icon} />
          <div className={baseStyles.title}>
            <FormattedMessage id="recieveWhyUseQRLabel" />
          </div>
        </div>

        <div className={baseStyles.divider} />

        <div className={baseStyles.section}>
          <div className={baseStyles.sectionContent}>
            <FormattedMessage id="sendQRExplanation" />
          </div>
        </div>

        <div className={baseStyles.section}>
          <div className={baseStyles.sectionTitle}>
            <FormattedMessage id="captureQRCaps" />
          </div>
          <div
            className={classNames(
              baseStyles.sectionContent,
              styles.qrCodeScannerSection,
            )}
          >
            <div className={styles.qrCodeScannerPlaceholder}>
              <div className={styles.frameLineTopRight} />
              <div className={styles.frameLineTopLeft} />
              <div className={styles.frameLineBottomRight} />
              <div className={styles.frameLineBottomLeft} />
              {this.getScanner()}
            </div>
          </div>
        </div>
        <div className={styles.scanButtonContainer}>
          <Button
            primary
            onClick={this.toggleScanner}
            disabled={!scannerActive && !cameraAvailable}
          >
            {scannerActive ? (
              <FormattedMessage id="modalActionCancel" />
            ) : (
              <FormattedMessage id="captureQR" />
            )}
          </Button>
        </div>
      </div>
    )
  }
}
