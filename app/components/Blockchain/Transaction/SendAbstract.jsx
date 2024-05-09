// @flow
import React, { Fragment } from 'react'
import classNames from 'classnames'
import { FormattedMessage, IntlShape, injectIntl } from 'react-intl'

import Button from '../../Button'
import styles from './Transaction.scss'
import SendIcon from '../../../assets/icons/send-tx.svg'
import ContactsAdd from '../../../assets/icons/contacts-add.svg'
import CopyToClipboard from '../../CopyToClipboard'

type Props = {
  txDate: React$Node,
  logo: React$Node,
  label: string,
  amount: string | number,
  contactTo: React$Node | string,
  to: string,
  contactToExists: boolean,
  showAddContactModal: (to: string) => void,
  isNetworkFee: boolean,
  intl: IntlShape,
}

class SendAbstract extends React.Component<Props> {
  render = () => {
    const {
      txDate,
      logo,
      label,
      amount,
      contactTo,
      to,
      contactToExists,
      showAddContactModal,
      isNetworkFee,
      intl,
    } = this.props
    return (
      <div className={classNames(styles.transactionContainer)}>
        <div className={styles.abstractContainer}>
          <div className={styles.txTypeIconContainer}>
            <div className={styles.sendIconContainer}>
              <SendIcon />
            </div>
          </div>
          {txDate}
          <div className={styles.txLabelContainer}>
            {logo}
            {label}
          </div>
          <div className={styles.txAmountContainer}>{amount}</div>
          <div className={styles.txToContainer}>
            {isNetworkFee ? (
              to
            ) : (
              <Fragment>
                <span>{contactTo}</span>
                <CopyToClipboard
                  className={styles.copy}
                  text={to}
                  tooltip={intl.formatMessage({ id: 'copyAddressTooltip' })}
                />
              </Fragment>
            )}
          </div>
          {isNetworkFee ? (
            <div className={styles.historyButtonPlaceholder} />
          ) : (
            <Button
              className={styles.transactionHistoryButton}
              renderIcon={ContactsAdd}
              onClick={() => showAddContactModal(to)}
              disabled={contactToExists}
            >
              <FormattedMessage id="activityAddAddress" />
            </Button>
          )}
        </div>
      </div>
    )
  }
}

export default injectIntl(SendAbstract)
