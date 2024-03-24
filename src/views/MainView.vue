<script setup>
import {computed, onMounted, ref} from 'vue'
import Web3 from 'web3'
import axios from 'axios'


const gasPrice = ref( 0 );
const myBalance = ref( 0 );
const intervalOnChain = ref(0);
const connectedAccount = ref('');
const hasMMExtension = !!window.ethereum;
const checkLoading = ref(false);
const unlockLoading = ref(false);

const addressLockIDs = ref([]);
const searchAddress = ref('');
const adressCheckLoading = ref(false)
const startblock = ref(0);
const endblock = ref(99999999);
const resultInfo = ref('')

const web3 = new Web3(window.ethereum)
if(!hasMMExtension) web3.setProvider('https://mainnet.infura.io/v3/d72d60bfe5ff400fb8b826f6bdd4c366')

console.log(web3)


//Load Pondwater Contract 
const address = '0xed96E69d54609D9f2cFf8AaCD66CCF83c8A1B470'

import {ABI} from '@/composables/pondwaterContractABI'

//instantiate the contract
const Pondwater = new web3.eth.Contract(ABI, address);

console.log("Pondwater", Pondwater);

/** CREATED SETUP **/
async function created() {

  const gasInterval = setInterval(async ()=>{
    const gas = await web3.eth.getGasPrice()
    //console.log(gas)
    gasPrice.value = parseInt(parseInt(gas)/1000000000);
  }, 5000)
  

  const interval = await Pondwater.methods.getIntervalFromChain().call();
  intervalOnChain.value = interval;

  if(hasMMExtension && false){
    var accounts = await window.ethereum.request({ method: 'eth_accounts' });
    connectedAccount.value = accounts[0];
  }

  //User is connected to Metamask
  if(connectedAccount.value) {
    const balance = await web3.eth.getBalance(connectedAccount.value);
    myBalance.value = web3.utils.fromWei(balance, "ether")


  }


 };
 created();

async function getEtherscan(autoload){
  const apiKey = '3HKCM3ZRWWZGD4T6EP7T3CITY6C98IB985';
  const contractAddress = '0xed96E69d54609D9f2cFf8AaCD66CCF83c8A1B470';
  const specificSenderAddress = searchAddress.value
  
console.log('getEtherscan', autoload)

if(!specificSenderAddress) return false;
if(!autoload){
  resultInfo.value = 'Loading...';
  addressLockIDs.value = [];
} 
adressCheckLoading.value = true;
const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${contractAddress}&startblock=${startblock.value}&endblock=${endblock.value}&sort=asc&apikey=${apiKey}`;

axios.get(url)
  .then(response => {
    console.log(response);
    if(response.data.status === "1" && response.data.message === "OK") {
      // Ensure that the result exists and is not empty
      
      const transactions = response.data.result;
      console.log(transactions);
      const filteredTransactions = transactions.filter(tx => tx.from.toLowerCase() === specificSenderAddress.toLowerCase());
      console.log(filteredTransactions);
      filteredTransactions.forEach(trx => {
        web3.eth.getTransaction(trx.hash)
        .then(tx => {
          console.log('tx', tx, web3.eth.abi.decodeParameter('uint256', tx.data))
          // Fetch the transaction receipt
          web3.eth.getTransactionReceipt(trx.hash)
            .then(receipt => {
              console.log('Transaction Receipt:', receipt);

              // Check if there are any logs in the receipt
              if (receipt.logs && receipt.logs.length > 0) {
                console.log('Logs found:', receipt.logs.length);

                // Iterate over the logs
                receipt.logs.forEach(async (log, index) => {
                  console.log(`Log #${index + 1}:`, log);

                  

                  // Decode the log manually
                  const decodedLog = {
                    locker: web3.eth.abi.decodeParameter('address', log.topics[1]),
                    id: web3.eth.abi.decodeParameter('uint', log.topics[2]),
                    data: web3.eth.abi.decodeParameter('uint256', log.data),
                  };

                  //decodedLog.data2 = web3.utils.hexToNumberString( decodedLog.data2)

                  console.log(`Log #${index + 1}:`, 'decodedLog', decodedLog);

                  if(index + 1 == 3) {
                    var newLockObj = {
                      lockId: parseInt(decodedLog.id),
                      lockResponse: await checkLock(parseInt(decodedLog.id)),
                      amount: web3.utils.fromWei(decodedLog.data, "ether")
                    }
                    addressLockIDs.value.push(newLockObj)
                  }

                  adressCheckLoading.value = false;

                });
              } else {
                console.log('No logs found in this transaction.');
              }
            })
            .catch(error => {
              console.error('Error fetching transaction receipt:', error);
            });
        })
      })

      //Autoload next transactions
      if(transactions.length == 10000){
        startblock.value = transactions[transactions.length-1].blockNumber;
        console.log('Restart Check', startblock.value)
        getEtherscan(true);

      }else{
        startblock.value = 0;
        if(addressLockIDs.value.length == 0) {
          adressCheckLoading.value = false;
          resultInfo.value = "No Locks found for this address."
        }
      }
    } else {
      console.error('No transactions found or error in API response:', response.data);
    }
  })
  .catch(error => {
    console.error('Error fetching transactions:', error);
  });
}

/** Connect Metamask */

async function connectToMetamask(){
  return false;
//check metamask is installed
if (window.ethereum) {
  var accounts;
      //request user to connect accounts (Metamask will prompt)

      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('eth_requestAccounts', accounts);
      
  console.log(accounts);
      //show the first connected account in the react page
      connectedAccount.value = accounts[0];
    } else {
      alert('Please download metamask');
    }
}

 /** Check Locks */

const lockId = ref(null)
const lockResponse = ref('')

async function checkLock(forceId){
  
  console.log(lockId.value, forceId);
  if( (!lockId.value && !forceId) ) return false;

  checkLoading.value = true;
  var searchLock = (forceId) ? forceId : lockId.value;

  const isOpenContract = await Pondwater.methods.isOpen().call();
if(!isOpenContract) {
  lockResponse.value = "CONTRACT IS CLOSED NO UNLOCKS POSSIBLE"
  return false;
}

  const response = await Pondwater.methods.locks(searchLock).call();
  console.log('checkLockData', response, isOpenContract)
  //if (!isOpen || ((lockData.startInterval + lockData.lastsFor) >= getIntervalFromChain())) revert CannotUnlockYet();
  //14239
  console.log(response.startInterval + response.lastsFor +'>='+ intervalOnChain.value)
  if(response.startInterval + response.lastsFor >= intervalOnChain.value){
    var lastsForMap = parseInt(response.lastsFor);
    if(lastsForMap == 128) lastsForMap = 49;
    else if(lastsForMap == 64) lastsForMap = 36;
    else if(lastsForMap == 32) lastsForMap = 25;

    var waitFor = parseInt(response.startInterval) + lastsForMap - parseInt(intervalOnChain.value) + 1;
    if(forceId) return `UNLOCK WILL FAIL - Unlocks in ${waitFor} Week(s)`;
    else lockResponse.value = `UNLOCK WILL FAIL - Unlocks in ${waitFor} Week(s)`;
  } 
  else if(response.lastsFor == 0 && response.owner == "0x0000000000000000000000000000000000000000") {
    if(forceId) return "LOCK IS ALREADY UNLOCKED";
    else lockResponse.value = "LOCK DOESN'T EXIST OR IS ALREADY UNLOCKED";
  }
  /*
  else if( !connectedAccount.value || response.owner.toLowerCase() != connectedAccount.value.toLowerCase()) {
    lockResponse.value = 'WRONG WALLET CONNECTED - ONLY THE OWNER CAN UNLOCK';
  }
  */
  else {
    if(forceId) return 'CAN BE UNLOCKED';
    else lockResponse.value = 'CAN BE UNLOCKED';
  }

  checkLoading.value = false;

}

/** UNLOCK */
async function unlock(){
  console.log("unlock", lockId.value);
  if( !lockId.value || unlockLoading.value) return false;

  unlockLoading.value = true;
  try {

    const response = await Pondwater.methods.unlock(lockId.value).send({from: connectedAccount.value})
    console.log(response)
    unlockLoading.value = false;
  } catch (error) {
    console.log(error)
    unlockLoading.value = true;
  }  
}
 
</script>

<template>
  <div class="mainContainer">
    <div class="wrapper">
      <div class="metamask_wrapper" v-if="false">
        <button @click="connectToMetamask" v-if="!connectedAccount">Connect Metamask</button>
        <p v-else>{{ connectedAccount }}</p>
      </div>
      <div class="gas_wrapper"><i class="fa-solid fa-gas-pump"></i> {{ gasPrice }}</div>
      <!--
      <div>BALANCE {{ myBalance }}</div>
      <div>Interval On Chain: {{ intervalOnChain }}</div>
    -->
    <div class="important_info_wrapper">
      <h3>IMPORTANT NOTES</h3>
      <ul>
        <li>
          This tool is not connected or affiliated in any way with the official Pond0x team. For the official site visit <a target="blank" href="https://www.pond0x.com/">www.pond0x.com</a>
        </li>
        <li>
          Don't connect your wallet to this site, if it asks to connect you're probably on the wrong site. Always check the URL if you're not on "pndc.dirtysix.de" leave the site. 
        </li>
        <li>
          If you run into issues or have questions contact me X (Twitter) at <a target="blank" href="https://twitter.com/Dirty_Six">@Dirty_Six</a>. 
          If not leave me a follow :)
        </li>
      </ul>
    </div>
      <div class="lock_check_wrapper">
        <h3>Check $PNDC Locks</h3>
        
        <div>
          <div class="address_check_form">
            <label>ETH address to look up</label>
            <input type="text" v-model="searchAddress" />
            <button class="check_button" @click.prevent="getEtherscan(false)">
              Check
              <i class="fa-solid fa-spinner fa-spin" v-if="adressCheckLoading"></i>
            </button>
          </div>
          <div class="addressLocksWrapper" v-if="addressLockIDs.length">
            <label>MY LOCKS</label>

            <div v-for="(lock, index) in addressLockIDs" :key="index" class="addressLock">
              <h3>Lock# {{ index + 1 }}</h3> 
              <ul>
                <li>ID: {{lock.lockId}}</li>
                <li>Amount: {{lock.amount}} PNDC</li>
                <li
                  :class="{
                    'success' :lockResponse == 'CAN BE UNLOCKED',
                    'failed' : lockResponse != 'CAN BE UNLOCKED'
                  }"  
                >
                  {{lock.lockResponse}}
                </li>
              </ul>
            </div>
          </div>
          <div v-else class="addressResultsInfo">
            {{ resultInfo }}
          </div>
        </div>
        <div v-if="false">
          <label>LOCK ID</label>
          <div class="lock_check_form">
            <input type="text" v-model="lockId" />
            <button class="check_button" @click.prevent="checkLock">
              Check
              <i class="fa-solid fa-spinner fa-spin" v-if="checkLoading"></i>
            </button>
          </div>
          <div class="lock_response" v-if="lockResponse"
            :class="{
              'success' :lockResponse == 'CAN BE UNLOCKED',
              'failed' : lockResponse != 'CAN BE UNLOCKED'
            }"
          >
            <i v-if="lockResponse == 'CAN BE UNLOCKED'" class="fa-solid fa-check"></i>
            <i v-else class="fa-solid fa-times"></i>
            {{ lockResponse }}
            <span v-if="lockResponse == 'CAN BE UNLOCKED'">
              You can go to the pondwater contract on etherscan and unlock. You find the contract link at <a href="https://www.pond0x.com/contracts">www.pond0x.com/contracts</a>
            </span>
          </div>
          <div v-if="false && lockResponse == 'CAN BE UNLOCKED'" class="unlockRow">
            <button class="unlock_button" @click.prevent="unlock">
              Unlock
              <i class="fa-solid fa-spinner fa-spin" v-if="unlockLoading"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
