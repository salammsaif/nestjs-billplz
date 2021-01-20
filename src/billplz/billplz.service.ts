import {
  LoggerService,
  HttpService,
  Injectable,
  Optional,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import {
  CONFIG_OPTIONS,
  BillPlzOptions,
  CreateCollection,
  GetCollectionResponse,
  CardProvider,
  CreateBill,
  CreateBillResponse,
  GetFPXBankListResponse,
  HttpMethod,
  Version,
} from './billplz.definition';

@Injectable()
export class BillPlzService {
  // billplz api endpoints
  readonly BASE_URL_V3 = 'https://www.billplz.com/api/v3';
  readonly BASE_URL_V4 = 'https://www.billplz.com/api/v4';
  readonly BASE_URL_SANDBOX_V3 = 'https://www.billplz-sandbox.com/api/v3';
  readonly BASE_URL_SANDBOX_V4 = 'https://www.billplz-sandbox.com/api/v4';

  // hash method to calculate x-signature
  readonly X_SIGNATURE_HASH = 'sha256';

  readonly BANK_CODES = {
    PHBMMYKL: 'Affin Bank Berhad',
    BPMBMYKL: 'AGROBANK / BANK PERTANIAN MALAYSIA BERHAD',
    MFBBMYKL: 'Alliance Bank Malaysia Berhad',
    RJHIMYKL: 'AL RAJHI BANKING & INVESTMENT CORPORATION (MALAYSIA) BERHAD',
    ARBKMYKL: 'AmBank (M) Berhad',
    BIMBMYKL: 'Bank Islam Malaysia Berhad',
    BKRMMYKL: 'Bank Kerjasama Rakyat Malaysia Berhad',
    BMMBMYKL: 'Bank Muamalat (Malaysia) Berhad',
    BSNAMYK1: 'Bank Simpanan Nasional Berhad',
    CIBBMYKL: 'CIMB Bank Berhad',
    CITIMYKL: 'Citibank Berhad',
    HLBBMYKL: 'Hong Leong Bank Berhad',
    HBMBMYKL: 'HSBC Bank Malaysia Berhad',
    KFHOMYKL: 'Kuwait Finance House',
    MBBEMYKL: 'Maybank / Malayan Banking Berhad',
    OCBCMYKL: 'OCBC Bank (Malaysia) Berhad',
    PBBEMYKL: 'Public Bank Berhad',
    RHBBMYKL: 'RHB Bank Berhad',
    SCBLMYKX: 'Standard Chartered Bank (Malaysia) Berhad',
    UOVBMYKL: 'United Overseas Bank (Malaysia) Berhad',
  };

  readonly PAYMENT_GATEWAY_ABBR = {
    ABMB0212: 'Alliance Bank',
    ABB0233: 'Affin Bank',
    AMBB0209: 'AmBank',
    BCBB0235: 'CIMB Clicks',
    BIMB0340: 'Bank Islam',
    BKRM0602: 'Bank Rakyat',
    BMMB0341: 'Bank Muamalat',
    BSN0601: 'BSN',
    CIT0217: 'Citibank Berhad',
    HLB0224: 'Hong Leong Bank',
    HSBC0223: 'HSBC Bank',
    KFH0346: 'Kuwait Finance House',
    MB2U0227: 'Maybank2u',
    MBB0227: 'Maybank2E',
    MBB0228: 'Maybank2E',
    OCBC0229: 'OCBC Bank',
    PBB0233: 'Public Bank',
    RHB0218: 'RHB Now',
    SCB0216: 'Standard Chartered',
    UOB0226: 'UOB Bank',
    'BP-PPL01': 'PayPal',
    'BP-2C2P1': 'e-pay',
    'BP-2C2PC': 'Visa / Mastercard',
    'BP-2C2PU': 'UnionPay',
    'BP-OCBC1': 'Visa / Mastercard',
    'BP-BST01': 'Boost',
    'BP-SGP01': 'Senangpay',

    // only applicable in staging environment
    TEST0001: 'Test 0001',
    TEST0002: 'Test 0002',
    TEST0003: 'Test 0003',
    TEST0004: 'Test 0004',
    TEST0021: 'Test 0021',
    TEST0022: 'Test 0022',
    TEST0023: 'Test 0023',
    'BP-FKR01': 'Billplz Simulator',
  };

  debugMode: boolean;
  sandbox: boolean;
  private apiKey: string;
  private xSignatureKey: string;
  private activeVersion: Version = Version.V3;
  private collectionID: string;
  private billID: string;
  private accountNumber: string;
  private payoutCollectionID: string;
  private payoutID: string;
  private cardID: string;
  private cardToken: string;
  private cardProvider: string;
  private activeBaseUrlV3: string;
  private activeBaseUrlV4: string;

  private logService?: LoggerService;

  constructor(
    private httpService: HttpService,
    @Inject(CONFIG_OPTIONS) options: BillPlzOptions,
  ) {
    this.debugMode = options.debugMode || true;
    this.sandbox = options.sandbox;
    this.apiKey = options.apiKey;
    this.xSignatureKey = options.xSignatureKey;
    this.collectionID = options.collectionID || null;
    this.billID = options.billID || null;
    this.accountNumber = options.accountNumber || null;
    this.payoutCollectionID = options.payoutCollectionID || null;
    this.payoutID = options.payoutID || null;
    this.cardID = options.cardID || null;
    this.cardToken = options.cardToken || null;
    this.cardProvider =
      options.cardProvider || CardProvider.CARD_PROVIDER_SENANGPAY;

    this.logService = options.logger;

    this.setBaseUrl();
  }

  setDebugMode(debugMode: boolean): this {
    this.debugMode = debugMode;
    return this;
  }

  private debug(data) {
    if (this.debugMode && this.logService) {
      this.logService.debug(data);
    }
  }

  setBaseUrl() {
    if (this.sandbox === false) {
      this.activeBaseUrlV3 = this.BASE_URL_V3;
      this.activeBaseUrlV4 = this.BASE_URL_V4;
    } else {
      this.activeBaseUrlV3 = this.BASE_URL_SANDBOX_V3;
      this.activeBaseUrlV4 = this.BASE_URL_SANDBOX_V4;
    }
  }

  setApiKey(apiKey: string): this {
    this.apiKey = apiKey;
    return this;
  }

  setXSignatureKey(xSignatureKey: string): this {
    this.xSignatureKey = xSignatureKey;
    return this;
  }

  setCollectionID(collectionID: string): this {
    this.collectionID = collectionID;
    return this;
  }

  setBillID(billID: string): this {
    this.billID = billID;
    return this;
  }

  setSandbox(sandbox: boolean): this {
    this.sandbox = sandbox;
    this.setBaseUrl();
    return this;
  }

  /**
   *
   * @param version
   * @returns {BillPlz}
   */
  useVersion(version: Version): this {
    this.activeVersion = version;
    return this;
  }

  private getUrl(version?: Version): string {
    const useVersion = version || this.activeVersion;
    if (useVersion === Version.V3) {
      return this.activeBaseUrlV3;
    } else if (useVersion === Version.V4) {
      return this.activeBaseUrlV4;
    }
  }

  private getApiCaller(httpMethod: HttpMethod, url: string, actionName = '') {
    const handleResponse = response => {
      const data = response.data;
      this.debug(
        JSON.stringify({
          source: 'BillPlzService',
          actionName,
          status: _.get(response, 'status'),
          statusText: _.get(response, 'statusText'),
        }),
      );
      return data;
    };

    const handlerError = error => {
      this.debug(
        JSON.stringify({
          source: 'BillPlzService',
          actionName,
          status: _.get(error, 'response.status'),
          statusText: _.get(error, 'response.statusText'),
          body: _.get(error, 'response.data'),
        }),
      );
      throw error;
    };

    if (httpMethod === HttpMethod.GET) {
      return (options = {}) => {
        const headers = this.buildHttpHeader({}, options);
        return this.httpService
          .get(url, { headers, ...options })
          .toPromise()
          .then(handleResponse)
          .catch(handlerError);
      };
    }

    if (httpMethod === HttpMethod.DELETE) {
      return (options = {}) => {
        const headers = this.buildHttpHeader({}, options);
        return this.httpService
          .delete(url, { headers, ...options })
          .toPromise()
          .then(handleResponse)
          .catch(handlerError);
      };
    }

    if (httpMethod === HttpMethod.POST) {
      return (data = {}, options = {}) => {
        const headers = this.buildHttpHeader({}, options);
        return this.httpService
          .post(url, data, { headers, ...options })
          .toPromise()
          .then(handleResponse)
          .catch(handlerError);
      };
    }

    if (httpMethod === HttpMethod.PUT) {
      return (data = {}, options = {}) => {
        const headers = this.buildHttpHeader({}, options);
        return this.httpService
          .put(url, data, { headers, ...options })
          .toPromise()
          .then(handleResponse)
          .catch(handlerError);
      };
    }

    if (httpMethod === HttpMethod.PATCH) {
      return (data = {}, options = {}) => {
        const headers = this.buildHttpHeader({}, options);
        return this.httpService
          .patch(url, data, { headers, ...options })
          .toPromise()
          .then(handleResponse)
          .catch(handlerError);
      };
    }
  }

  private buildHttpHeader(headers, options: any) {
    if (options.apiKey) {
      headers.Authorization = `Basic ${options.apiKey}`;
      delete options.apiKey;
    } else {
      headers.Authorization = `Basic ${this.apiKey}`;
    }
    return headers;
  }

  /**
   *
   * @param data Object
   * { title: collectionTitle }
   * @param options Object Options for http config
   * @returns {*}
   * @link https://www.billplz.com/api?shell#v3-collections-create-a-collection
   */
  async createCollection(
    data: CreateCollection,
    options: { apiKey?: string } = {},
  ): Promise<GetCollectionResponse[]> {
    const url = this.getUrl() + '/collections';
    const api = this.getApiCaller(HttpMethod.POST, url, 'createCollection');
    return await api(data, options);
  }

  /**
   *
   * @param collectionID String
   * @param options Object Options for http config
   * @returns {*}
   * @link https://www.billplz.com/api?shell#v3-collections-get-a-collection
   */
  async getCollection(
    collectionID?: string,
    options: { apiKey?: string } = {},
  ): Promise<GetCollectionResponse[]> {
    const url =
      this.getUrl() + '/collections/' + (collectionID || this.collectionID);
    const api = this.getApiCaller(HttpMethod.GET, url, 'getCollection');
    return await api(options);
  }

  /**
   *
   * @param data Object
   * @param options Object Options for http config
   * @returns {*}
   * @link https://www.billplz.com/api?shell#v3-bills-create-a-bill
   */
  async createBill(
    data: CreateBill,
    options: { apiKey?: string } = {},
  ): Promise<CreateBillResponse> {
    data = { collection_id: this.collectionID, ...data };

    const url = this.getUrl() + '/bills';
    const api = this.getApiCaller(HttpMethod.POST, url, 'createBill');
    return await api(data, options);
  }

  /**
   *
   * @param billID
   * @param options Object Options for http config
   * @returns {*}
   * @link https://www.billplz.com/api?shell#v3-bills-get-a-bill
   */
  async getBill(billID?: string, options = {}): Promise<CreateBillResponse> {
    const url = this.getUrl() + '/bills/' + (billID || this.billID);
    const api = this.getApiCaller(HttpMethod.GET, url, 'getBill');
    return await api(options);
  }

  /**
   *
   * @param billID
   * @param options Object Options for http config
   * @returns {*}
   * @link https://www.billplz.com/api?shell#v3-bills-delete-a-bill
   */
  async deleteBill(billID = null, options = {}) {
    const url = this.getUrl() + '/bills/' + (billID || this.billID);
    const api = this.getApiCaller(HttpMethod.DELETE, url, 'deleteBill');
    return await api(options);
  }

  /**
   *
   * @param activeOnly
   * @param options Object Options for http config
   * @returns {*}
   * @link https://www.billplz.com/api?shell#v3-get-fpx-banks
   */
  async getFPXBankList(
    activeOnly = false,
    options: { apiKey?: string } = {},
  ): Promise<GetFPXBankListResponse[]> {
    const filterActive = data => {
      return data.active === true;
    };

    const setDisplayBankName = data => {
      data.display_bank_name = this.PAYMENT_GATEWAY_ABBR[data.name] || '';
      return data;
    };

    const url = this.getUrl(Version.V3) + '/fpx_banks';
    const api = this.getApiCaller(HttpMethod.GET, url, 'getFPXBankList');
    return await api(options).then(data => {
      let results = data.banks;
      results = results.map(setDisplayBankName);
      if (activeOnly) {
        return results.filter(filterActive);
      } else {
        return results;
      }
    });
  }

  /**
   *
   * @param data Object
   * @param xSignatureKey
   * @returns {boolean}
   * @link https://www.billplz.com/api?shell#x-signature
   */
  validateXSignature(data, xSignatureKey = null): boolean {
    const targetKeys = [
      'amount',
      'collection_id',
      'due_at',
      'email',
      'id',
      'mobile',
      'name',
      'paid_amount',
      'paid_at',
      'paid',
      'state',
      'url',
    ];

    let targetString = '';
    targetKeys.map(key => {
      if (data[key] !== undefined) {
        targetString += `${key}${data[key]}|`;
      }
    });
    targetString = targetString.slice(0, -1);

    const hmac = crypto.createHmac(
      this.X_SIGNATURE_HASH,
      xSignatureKey || this.xSignatureKey,
    );
    hmac.update(targetString);

    const calculatedXSig = hmac.digest('hex');
    return calculatedXSig === data.x_signature;
  }
}

/*__setAccountNumber(accountNumber: string): this {
  this.accountNumber = accountNumber;
  return this;
};*/

/*__setPayoutCollectionID(payoutCollectionID: string): this {
  this.payoutCollectionID = payoutCollectionID;
  return this;
};*/

/*__setPayoutID(payoutID: string): this {
  this.payoutID = payoutID;
  return this;
};*/

/*__setCardID(cardID: string): this {
  this.cardID = cardID;
  return this;
};*/

/*__setCardToken(cardToken: string): this {
  this.cardToken = cardToken;
  return this;
};*/

/*__setCardProvider(cardProvider: CardProvider): this {
  this.cardProvider = cardProvider;
  return this;
};*/

/**
 *
 * @param data Object
 * { title: collectionTitle }
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-create-a-collection
 */
/*__createCollection(data = {}, options = {}) {
  const url = this.getUrl() + '/collections';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'createCollection',
  );
  return api(data, options);
};*/

/**
 *
 * @param collectionID String
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-get-a-collection
 */
/*__getCollection(collectionID = null, options = {}) {
  const url =
    this.getUrl() + '/collections/' + (collectionID || this.collectionID);
  const api = this.getApiCaller(HttpMethod.GET, url, 'getCollection');
  return api(options);
};*/

/**
 *
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-get-collection-index
 */
/*__getCollectionList(options = {}) {
  const url = this.getUrl() + '/collections';
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getCollectionList',
  );

  return api(options).then((data) => data.collections);
};*/

/**
 *
 * @param data Object
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-create-an-open-collection
 */
/*__createOpenCollection(data = {}, options = {}) {
  const url = this.getUrl() + '/open_collections';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'createOpenCollection',
  );
  return api(data, options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-get-an-open-collection
 */
/*__getOpenCollection(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl() + '/open_collections/' + (collectionID || this.collectionID);
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getOpenCollection',
  );
  return api(options);
};*/

/**
 *
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-get-an-open-collection-index
 */
/*__getOpenCollectionList(options = {}) {
  const url = this.getUrl() + '/open_collections';
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getOpenCollectionList',
  );
  return api(options).then((data) => data.open_collections);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-deactivate-a-collection
 */
/*__deactivateCollection(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/deactivate';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'deactivateCollection',
  );
  return api(options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-collections-activate-a-collection
 */
/*__activateCollection(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/activate';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'activateCollection',
  );
  return api(options);
};*/

/**
 *
 * @param accountNumber
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-registration-check-by-bank-account-number
 */
/*__getBankAccountVerification(
  accountNumber = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl() +
    '/check/bank_account_number/' +
    (accountNumber || this.accountNumber);
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getBankAccountVerification',
  );
  return api(options);
};*/

/**
 *
 * @param billID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-transactions-get-transaction-index
 */
/*__getTransactionList(billID = null, options = {}) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/bills/' +
    (billID || this.billID) +
    '/transactions';
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getTransactionList',
  );
  return api(options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-payment-methods-get-payment-method-index
 */
/*__getPaymentMethodList(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/payment_methods';
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getPaymentMethodList',
  );
  return api(options).then((data) => data.payment_methods);
};*/

/**
 *
 * @param collectionID
 * @param data Object
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-payment-methods-update-payment-methods
 */
/*__updatePaymentMethod(
  collectionID = null,
  data = {},
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/payment_methods';
  const api = this.getApiCaller(
    HttpMethod.PUT,
    url,
    'updatePaymentMethod',
  );
  return api(data, options).then((data) => data.payment_methods);
};*/

/**
 *
 * @param accountNumbers
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-bank-account-direct-verification-get-bank-account-index
 */
/*__getBankAccountVerifyList(
  accountNumbers = [],
    options: { apiKey?: string } = {},
) {
  let accountNumberParams = '';
  accountNumbers.map(function(accountNumber) {
    accountNumberParams += 'account_numbers[]=' + accountNumber + '&';
  });
  accountNumberParams = accountNumberParams.slice(0, -1);

  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/bank_verification_services?' +
    accountNumberParams;
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getBankAccountVerifyList',
  );
  return api(options).then((data) => data.bank_verification_services);
};*/

/**
 *
 * @param accountNumber
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-bank-account-direct-verification-get-a-bank-account
 */
/*__getBankAccountVerify(
  accountNumber = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) +
    '/bank_verification_services/' +
    (accountNumber || this.accountNumber);
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getBankAccountVerify',
  );
  return api(options);
};*/

/**
 *
 * @param data Object
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v3-bank-account-direct-verification-create-a-bank-account
 */
/*__createBankAccount(data = {}, options = {}) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V3) + '/bank_verification_services';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'createBankAccount',
  );
  return api(data, options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-collections-customer-receipt-delivery-activate
 */
/*__activateReceiptDelivery(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/customer_receipt_delivery/activate';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'activateReceiptDelivery',
  );
  return api(options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-collections-customer-receipt-delivery-deactivate
 */
/*__deactivateReceiptDelivery(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/customer_receipt_delivery/deactivate';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'deactivateReceiptDelivery',
  );
  return api(options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-collections-customer-receipt-delivery-set-global
 */
/*__setReceiptDeliveryUseGlobal(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/customer_receipt_delivery/global';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'setReceiptDeliveryUseGlobal',
  );
  return api(options);
};*/

/**
 *
 * @param collectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-collections-customer-receipt-delivery-get-status
 */
/*__getReceiptDeliveryConfig(
  collectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/collections/' +
    (collectionID || this.collectionID) +
    '/customer_receipt_delivery';
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getReceiptDeliveryConfig',
  );
  return api(options);
};*/

/**
 *
 * @param title
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-payout-collections-create-a-payout-collection
 */
/*__createPayoutCollection(title, options = {}) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/mass_payment_instruction_collections';
  const api = this.getApiCaller(
    HttpMethod.POST,
    url,
    'createPayoutCollection',
  );
  return api({ title }, options);
};*/

/**
 *
 * @param payoutCollectionID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-payout-collections-get-a-payout-collection
 */
/*__getPayoutCollection(
  payoutCollectionID = null,
    options: { apiKey?: string } = {},
) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/mass_payment_instruction_collections/' +
    (payoutCollectionID || this.payoutCollectionID);
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getPayoutCollection',
  );
  return api(options);
};*/

/**
 *
 * @param data Object
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-payout-create-a-payout
 */
/*__createPayout(data, options = {}) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) + '/mass_payment_instructions';
  const api = this.getApiCaller(HttpMethod.POST, url, 'createPayout');
  return api(data, options);
};*/

/**
 *
 * @param payoutID
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-payout-get-a-payout
 */
/*__getPayout(payoutID = null, options = {}) {
  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/mass_payment_instructions/' +
    (payoutID || this.payoutID);
  const api = this.getApiCaller(HttpMethod.GET, url, 'getPayout');
  return api(options);
};*/

/**
 *
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-webhook-rank
 */
/*__getWebhookRank(options = {}) {
  const url = this.getUrl(this.CONSTANTS.VERSION_V4) + '/webhook_rank';
  const api = this.getApiCaller(HttpMethod.GET, url, 'getWebhookRank');
  return api(options);
};*/

/**
 *
 * @param activeOnly
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-get-payment-gateways
 */
/*getPaymentGateways(
  activeOnly = true,
    options: { apiKey?: string } = {},
) {
  const filterActive = (data) => {
    return data.active === true;
  }

  const setDisplayBankName = (data) => {
    data.display_bank_name =
      this.PAYMENT_GATEWAY_ABBR[data.code] || '';
    return data;
  }

  const url = this.getUrl(this.VERSION_V4) + '/payment_gateways';
  const api = this.getApiCaller(
    HttpMethod.GET,
    url,
    'getPaymentGateways',
  );
  return api(options).then((data) => {
    let results = data.payment_gateways;
    results = results.map(setDisplayBankName);
    if (activeOnly) {
      return results.filter(filterActive);
    } else {
      return results;
    }
  });
};*/

/**
 *
 * @param data Object
 * @param options Object Options for http config
 * @param provider
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-tokenization-senangpay-create-card
 * @link https://www.billplz.com/api?shell#v4-tokenization-ocbc-create-card
 */
/*__createCard(
  data = {},
    options: { apiKey?: string } = {},
  provider = null,
) {
  provider = provider || this.cardProvider;
  let endpoint;
  if (provider === this.CONSTANTS.CARD_PROVIDER_SENANGPAY) {
    endpoint = 'cards';
  } else if (provider === this.CONSTANTS.CARD_PROVIDER_OCBC) {
    endpoint = 'ocbc_cards';
  }

  const url = this.getUrl(this.CONSTANTS.VERSION_V4) + '/' + endpoint;
  const api = this.getApiCaller(HttpMethod.POST, url, 'createCard');
  return api(data, options);
};*/

/**
 *
 * @param cardID
 * @param provider
 * @param options Object Options for http config
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-tokenization-senangpay-delete-card
 * @link https://www.billplz.com/api?shell#v4-tokenization-ocbc-delete-card
 */
/*__deleteCard(
  cardID = null,
  provider = null,
    options: { apiKey?: string } = {},
) {
  provider = provider || this.cardProvider;
  let endpoint;
  if (provider === this.CONSTANTS.CARD_PROVIDER_SENANGPAY) {
    endpoint = 'cards';
  } else if (provider === this.CONSTANTS.CARD_PROVIDER_OCBC) {
    endpoint = 'ocbc_cards';
  }

  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/' +
    endpoint +
    '/' +
    (cardID || this.cardID);
  const api = this.getApiCaller(HttpMethod.DELETE, url, 'deleteCard');
  return api(options);
};*/

/**
 *
 * @param billID
 * @param data Object
 * @param options Object Options for http config
 * @param provider
 * @returns {*}
 * @link https://www.billplz.com/api?shell#v4-tokenization-senangpay-charge-card
 * @link https://www.billplz.com/api?shell#v4-tokenization-ocbc-charge-card
 */
/*__chargeCard(
  billID = null,
  data = {},
    options: { apiKey?: string } = {},
  provider = null,
) {
  data = { ...{ card_id: this.cardID, token: this.cardToken }, ...data };

  provider = provider || this.cardProvider;
  let endpoint;
  if (provider === this.CONSTANTS.CARD_PROVIDER_SENANGPAY) {
    endpoint = 'charge';
  } else if (provider === this.CONSTANTS.CARD_PROVIDER_OCBC) {
    endpoint = 'ocbc_charge';
  }

  const url =
    this.getUrl(this.CONSTANTS.VERSION_V4) +
    '/bills/' +
    (billID || this.billID) +
    '/' +
    endpoint;
  const api = this.getApiCaller(HttpMethod.POST, url, 'chargeCard');
  return api(data, options);
};*/
