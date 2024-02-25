<script setup>
import {computed, onMounted, ref} from 'vue'
import Web3 from 'web3'

const gasPrice = ref( 0 );
const myBalance = ref( 0 );
const intervalOnChain = ref(0);
const connectedAccount = ref('');
const hasMMExtension = !!window.ethereum;
const checkLoading = ref(false);
const unlockLoading = ref(false);

const web3 = new Web3(window.ethereum) //'https://mainnet.infura.io/v3/d72d60bfe5ff400fb8b826f6bdd4c366'
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
    console.log(gas)
    gasPrice.value = parseInt(parseInt(gas)/1000000000);
  }, 5000)
  

  const interval = await Pondwater.methods.getIntervalFromChain().call();
  intervalOnChain.value = interval;

  if(hasMMExtension){
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



/** Connect Metamask */

async function connectToMetamask(){
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

async function checkLock(){
  
  console.log(lockId.value);
  if( !lockId.value || checkLoading.value) return false;

  checkLoading.value = true;

  const isOpenContract = await Pondwater.methods.isOpen().call();
if(!isOpenContract) {
  lockResponse.value = "CONTRACT IS CLOSED NO UNLOCKS POSSIBLE"
  return false;
}

  const response = await Pondwater.methods.locks(lockId.value).call();
  console.log('checkLockData', response, isOpenContract)
  //if (!isOpen || ((lockData.startInterval + lockData.lastsFor) >= getIntervalFromChain())) revert CannotUnlockYet();
  //14239
  console.log(response.startInterval + response.lastsFor +'>='+ intervalOnChain.value)
  if(response.startInterval + response.lastsFor >= intervalOnChain.value){
    var waitFor = (response.startInterval + response.lastsFor - intervalOnChain.value == 0) ? 1 : response.startInterval + response.lastsFor - intervalOnChain.value;
    lockResponse.value = `UNLOCK WILL FAIL - Unlocks in ${waitFor} Interval(s)`;
  } 
  else if(response.lastsFor == 0 && response.owner == "0x0000000000000000000000000000000000000000") {
    lockResponse.value = "LOCK DOESN'T EXIST OR IS ALREADY UNLOCKED";
  }
  else if(response.owner != connectedAccount.value) {
    lockResponse.value = 'WRONG WALLET CONNECTED - ONLY THE OWNER CAN UNLOCK';
  }
  else lockResponse.value = 'CAN BE UNLOCKED';

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
      <div class="metamask_wrapper">
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
          Don't accept a unlock transaction if it shows a ridiculous high gas fee.
        </li>
        <li>
          Use this tool at your own risk. 
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
          </div>
          <div v-if="lockResponse == 'CAN BE UNLOCKED'" class="unlockRow">
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
