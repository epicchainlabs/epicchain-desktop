// @flow
import React, { Component } from 'react'

import Button from '../../Button'
import { ROUTES } from '../../../core/constants'
import styles from './EncryptQR.scss'
import FullHeightPanel from '../../Panel/FullHeightPanel'
import CloseButton from '../../CloseButton'
import BackButton from '../../BackButton'
import ConfirmIcon from '../../../assets/icons/confirm.svg'
import CopyIcon from '../../../assets/icons/copy.svg'
import CheckIcon from '../../../assets/icons/check.svg'
import AddIcon from '../../../assets/icons/add.svg'
import withCopyCanvasToClipboard from '../../../hocs/withCopyCanvasToClipboard'

type Props = {
  encryptedWIF: string,
  resetEncryptedWIF: Function,
  handleCopy: (?HTMLCanvasElement, string, ?boolean) => Promise<void>,
  handleCreateCanvas: (?HTMLCanvasElement, string) => any,
  copied: boolean,
}

class EncryptQR extends Component<Props> {
  encryptedCanvas: ?HTMLCanvasElement

  componentDidMount() {
    const { encryptedWIF } = this.props
    this.props.handleCreateCanvas(this.encryptedCanvas, encryptedWIF)
  }

  render() {
    const { resetEncryptedWIF } = this.props
    return (
      <FullHeightPanel
        headerText="Encrypted QR Code"
        renderInstructions={false}
        headerContainerClassName={styles.headerIconMargin}
        renderHeaderIcon={() => <CheckIcon />}
        renderCloseButton={() => (
          <div onClick={resetEncryptedWIF}>
            <CloseButton routeTo={ROUTES.SETTINGS} />
          </div>
        )}
        renderBackButton={() => <BackButton routeTo={ROUTES.ENCRYPT} />}
        iconColor="#F7BC33"
      >
        <div
          id="encrypted-wif-qr-codes"
          className={styles.encryptedKeyContainer}
        >
          <div className={styles.qrContainer}>
            <div className={styles.qr}>
              <label> encrypted key </label>
              <canvas
                ref={node => {
                  this.encryptedCanvas = node
                }}
              />
              <Button
                className={styles.submitButton}
                renderIcon={() =>
                  this.props.copied ? <ConfirmIcon /> : <CopyIcon />
                }
                type="submit"
                onClick={() => {
                  this.props.handleCopy(this.encryptedCanvas, 'encrypted-wif')
                }}
              >
                Copy Code Image
              </Button>
            </div>
          </div>
        </div>
        <div className={styles.qrPrintButtonContainer}>
          <Button renderIcon={AddIcon} primary onClick={this.handlePrint}>
            Print
          </Button>
        </div>
      </FullHeightPanel>
    )
  }

  handlePrint = () => {
    window.print()
  }
}

export default withCopyCanvasToClipboard(EncryptQR)
