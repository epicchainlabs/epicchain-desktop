// @flow
import React from 'react'
import classNames from 'classnames'
import { FormattedMessage, injectIntl, IntlShape } from 'react-intl'

import Button from '../../Button'
import ReceiveIcon from '../../../assets/icons/receive-tx.svg'
import ContactsAdd from '../../../assets/icons/contacts-add.svg'
import CopyToClipboard from '../../CopyToClipboard'

import styles from './Transaction.scss'

type Props = {
  txDate: React$Node,
  logo: React$Node,
  label: string,
  amount: string | number,
  showAddContactModal: (from: string) => void,
  contactFromExists: boolean,
  from: string,
  contactFrom: React$Node | string,
  contactFromExists: boolean,
  intl: IntlShape,
}

class ReceiveAbstract extends React.Component<Props> {
  render = () => {
    const {
      txDate,
      logo,
      label,
      amount,
      contactFrom,
      showAddContactModal,
      contactFromExists,
      from,
      intl,
    } = this.props
    const isMintTokens = from === 'MINT TOKENS'

    return (
      <div className={classNames(styles.transactionContainer)}>
        <div className={styles.abstractContainer}>
          <div className={styles.txTypeIconContainer}>
            <div className={styles.receiveIconContainer}>
              <ReceiveIcon />
            </div>
          </div>
          {txDate}
          <div className={styles.txLabelContainer}>
            {logo}
            {label}
          </div>
          <div className={styles.txAmountContainer}>{amount}</div>
          <div className={styles.txToContainer}>
            <span>{contactFrom}</span>
            {!isMintTokens && (
              <CopyToClipboard
                className={styles.copy}
                text={from}
                tooltip={intl.formatMessage({ id: 'copyAddressTooltip' })}
              />
            )}
          </div>
          <Button
            className={styles.transactionHistoryButton}
            renderIcon={ContactsAdd}
            onClick={() => showAddContactModal(from)}
            disabled={contactFromExists}
          >
            <FormattedMessage id="activityAddAddress" />
          </Button>
        </div>
      </div>
    )
  }
}

export default injectIntl(ReceiveAbstract)
