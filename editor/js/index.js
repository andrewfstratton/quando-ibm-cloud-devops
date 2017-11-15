(() => {
  let self = this['index'] = {}
  let _userid = null
  let _content = ''
  let _deploy = ''
  let _remote_list = []
  let PREFIX = 'quando_'

  window.onload = () => {
    self.setup()
  }
  window.onbeforeunload = () => {
    return 'Are you sure you want to leave the editor?' // Doesn't seem to show this message in Chrome?!
  }
  function _encodeXml (str) {
    return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
  }
  self.setup = () => {
    $('#login_modal').keypress((e) => {
      if (e.which === 13) {
        self.handle_login()
      }
    })
    $('#loading_modal_message').html('Checking for user session...')
    $('#loading_modal').modal('toggle')
    $.ajax({
      url: '/login',
      success: (res) => {
        if (res.success) {
          _success('Logged in')
          _userid = res.userid
          _show_user_status()
        } else {
          _warning(res.message)
        }
        $('#loading_modal').modal('toggle')
        quando_editor.inject(Blockly)
      },
      error: () => {
        _error('Failed to find server')
        $('#loading_modal').modal('toggle')
        quando_editor.inject(Blockly)
      }
    })
  }
  self.handle_login = () => {
    let userid = $('#userid').val()
    let password = $('#password').val()
    let message_elem = $('#login_modal_footer_message')
    message_elem.html('Checking... ')
    $.ajax({
      url: '/login',
      type: 'POST',
      data: { 'userid': userid, 'password': password },
      success: (res, status, xhr) => {
        if (res.success) {
          message_elem.html('')
          _success('Logged in')
          $('#login_modal').modal('toggle')
          _userid = userid
          _show_user_status()
        } else {
          message_elem.html('Failed: ' + res.message)
        }
      },
      error: () => {
        message_elem.html('Failed to find server ')
      }
    })
  }
  self.handle_load = () => {
    if (_userid) {
      _remote_load_list()
      $('#remote_load_modal').modal('toggle')
    } else {
      _local_load_list()
      $('#local_load_modal').modal('toggle')
    }
  }
  self.handle_save = () => {
    if (_userid) {
      $('#remote_save_modal').modal('toggle')
    } else {
      $('#local_save_modal').modal('toggle')
    }
  }
  self.handle_clear = () => {
    _info('Cleared...')
    _content = ''
    _deploy = ''
    $('#file_name').html('[no file]')
    Blockly.mainWorkspace.clear()
  }
  self.handle_logout = () => {
    $.ajax({
      url: '/login',
      type: 'DELETE',
      success: (res, status, xhr) => {
        _info('Logged out')
        _userid = null
        _show_user_status()
      },
      error: () => {
        $('#loading_modal_message').html('Failed to find server')
      }
    })
  }
  self.handle_remote_to_local_load = () => {
    _local_load_list()
    $('#remote_load_modal').modal('toggle')
    $('#local_load_modal').modal('toggle')
  }
  self.handle_remote_to_local_save = () => {
    $('#remote_save_modal').modal('toggle')
    $('#local_save_modal').modal('toggle')
  }
  self.handle_local_save = () => {
    let key = $('#local_save_key').val()
    localStorage.setItem(PREFIX + key, JSON.stringify({
      deploy: _deploy,
      xml: _getXml(),
      content: _content
    }))
    $('#local_save_modal').modal('toggle')
    _saved(key)
  }
  self.handle_remote_save = () => {
    let name = encodeURI($('#remote_save_key').val())
    let obj = JSON.stringify({ deploy: _deploy, xml: _getXml(), content: _content })
    $.ajax({
      url: '/script',
      type: 'POST',
      data: { userid: _userid, name: name, script: obj },
      success: (res) => {
        if (res.success) {
          $('#remote_save_modal').modal('toggle')
          _saved(decodeURI(name))
        } else {
          alert('Failed to save')
        }
      },
      error: () => {
        alert('Failed to find server')
      }
    })
  }
  self.handle_show_xml = () => {
    $('#menu_dropdown').dropdown('toggle')
    $('#show_modal_title').html('Show Xml')
    $('#show_modal').modal('toggle')
    $('#show_modal_code').removeClass('language-javascript').addClass('language-xml')
    $('#show_modal_code').html(_encodeXml(_getXml()))
  }
  self.handle_show_code = () => {
    $('#menu_dropdown').dropdown('toggle')
    $('#show_modal_title').html('Show Code')
    $('#show_modal').modal('toggle')
    $('#show_modal_code').removeClass('language-xml').addClass('language-javascript')
    $('#show_modal_code').html(quando_editor.getCode())
  }
  function _notify (message, style) {
    $('#top_status').notify(message, { position: 'bottom', className: style, style: 'bootstrap' })
  }
  function _success (message) {
    _notify(message, 'success')
  }
  function _info (message) {
    _notify(message, 'info')
  }
  function _error (message) {
    _notify(message, 'error')
  }
  function _warning (message) {
    _notify(message, 'warn')
  }
  self.handle_deploy = () => {
    let code = quando_editor.getCode()
    if (code) {
      let filename = 'guest'
      if (_userid) {
        filename = prompt('Please enter the deployment filename \n(without a suffix)', _deploy)
      }
      if (filename !== null) {
        if (filename == '') {
          alert('Filename cannot be blank')
        } else {
          $.ajax({
            url: '/script/deploy/' + encodeURI(filename),
            type: 'PUT',
            data: { javascript: code },
            success: () => {
              _deploy = filename
              _success("Deployed as '" + filename + ".js'")
            },
            error: () => {
              alert('Failed to find server')
            }
          })
        }
      }
    } else {
      alert('Behaviour incomplete.')
    }
  }
  self.handle_test = () => {
    let code = quando_editor.getCode()
    if (code) {
      let filename = '_'
      $.ajax({
        url: '/script/deploy/' + encodeURI(filename),
        type: 'PUT',
        data: { javascript: code },
        success: () => {
          _success('Opening Test...')
          let deploy_window = window.open('/client/js/' + filename + '.js', 'quando_deployed_test',
                        'left=0,top=0,width=9999,height=9999')
          deploy_window.focus() // moveTo(0,0);
        },
        error: () => {
          alert('Failed to find server')
        }
      })
    } else {
      alert('Behaviour incomplete.')
    }
  }
  self.handle_file = (media, block_id, widget_id, path = '') => {
        // when media is 'UPLOAD', then we are uploading, note then that block_id and widget_id are null
    let file_modal = $('#file_modal')
    if (media == 'UPLOAD') {
      $('.file_modal_upload').show()
      $('.file_modal_select_file').hide()
    } else {
      $('.file_modal_select_file').show()
      $('.file_modal_upload').hide()
    }
    $('#file_modal_path').html('Loading...')
    file_modal.modal('show')
    $('#file_list').html('Loading...')
    $.ajax({
      url: '/file/type' + path + '/' + media,
      success: (res) => {
        if (res.success) {
          $('#file_modal_path').html(path)
          $('#file_list').html('')
          if (path != '') {
            let parent_path = ''
            let slash_loc = path.lastIndexOf('/')
            if (slash_loc > 0) {
              parent_path = path.substring(0, slash_loc)
            }
            $('#file_list').append(_folder_list_add('..', media, parent_path,
                            block_id, widget_id))
          }
          for (let i in res.folders) {
            $('#file_list').append(_folder_list_add(res.folders[i], media, path + '/' + res.folders[i],
                            block_id, widget_id))
          }
          if (path != '') {
            path = path.substring(1) + '/' // strip off the intial slash and put infront of the file
          }
          for (let i in res.files) {
            $('#file_list').append(_file_list_add(res.files[i], path,
                            'handle_file_selected', block_id, widget_id))
          }
        } else {
          alert('Failed to find server files')
          $('#file_modal').modal('toggle')
        }
      },
      error: () => {
        alert('Failed to access server')
        $('#file_modal').modal('toggle')
      }
    })
  }
  self.handle_folder_selected = (media, block_id, widget_id, path) => {
    self.handle_file(media, block_id, widget_id, path)
  }
  self.handle_file_selected = (filename, block_id, widget_id) => {
        // When blocK-id is null, then this is an upload - so do nothing...
    if (block_id != null) {
      let block = Blockly.mainWorkspace.getBlockById(block_id)
      block.setFieldValue(filename, widget_id)
      $('#file_modal').modal('hide')
    }
        // TODO get/return/set filename
  }
  self.handle_upload_media = () => {
    if ($('#upload_media').val()) {
      self.handle_file('UPLOAD', null, null, '')
    }
  }
  self.handle_upload = () => {
    let file_in = $('#upload_media').val()
    let filename = encodeURI(file_in.substring(1 + file_in.lastIndexOf('\\')))
    let remote_path = encodeURI($('#file_modal_path').html())
    let form_data = new FormData()
    form_data.append('upload_data', $('#upload_media')[0].files[0]) // wierd jquery format...
    $.ajax({
            // url: '/upload', // was '/file/upload' + remote_path + '/' + filename,
      url: '/file/upload' + remote_path + '/' + filename,
      type: 'POST',
      data: form_data,
      processData: false,
      contentType: false,
      success: (res) => {
        if (res.success) {
          $('#file_modal').modal('toggle')
          _success('Uploaded...' + decodeURI(remote_path + filename))
          $('#upload_media').val(null) // clear once finished - forces a change event next time
        } else {
          alert('Failed to save')
        }
      },
      error: () => {
        alert('Failed to find server')
      }
    })
  }
  self.local_load = (key) => {
    let obj = JSON.parse(localStorage.getItem(key))
    let name = key.slice(PREFIX.length)
    _loaded(obj, '#local_load_modal', name)
  }
  self.remote_load = (index) => {
        // debugger
    $.ajax({
      url: '/script/id/' + _remote_list[index].id,
      success: (res) => {
        if (res.success) {
          let xml = JSON.parse(res.doc.xml)
          _loaded(xml, '#remote_load_modal', res.doc.name)
        } else {
          alert('Failed to find script')
        }
      },
      error: () => {
        alert('Failed to access server')
      }
    })
  }
  self.local_delete = (key) => {
    if (confirm("Delete forever '" + key + "'?")) {
      localStorage.removeItem(key)
      _local_load_list()
    }
  }
  self.remote_delete = (index) => {
    if (confirm("Delete forever '" + _remote_list[index].name + "' saved " +
            _remote_list[index].date + ' ?')) {
      $.ajax({
        url: '/script/id/' + _remote_list[index].id,
        type: 'DELETE',
        success: (res) => {
          if (!res.success) {
            alert(res.message) // V hard to fail - if possible at all
          }
          _remote_load_list()
        },
        error: () => {
          alert('Failed to find server')
        }
      })
    }
  }
  function _show_user_status () {
    if (_userid) {
      $('#top_status').html(' ' + _userid)
    } else {
      $('#top_status').html(' Guest')
    }
  }
  function _loaded (obj, modal_id, name) {
    Blockly.mainWorkspace.clear() // Note - this is deferred - so must force the load to be later
    setTimeout(() => {
      _showXml(obj.xml)
      _content = obj.content
      _deploy = obj.deploy
      $(modal_id).modal('toggle')
      _success('Loaded...')
      $('#local_save_key').val(name)
      $('#remote_save_key').val(name)
      $('#file_name').html(name)
    }, 0)
  }
  function _saved (name) {
    _success('Saved...')
    $('#local_save_key').val(name)
    $('#remote_save_key').val(name)
    $('#file_name').html(name)
  }
  function _remote_load_list () {
    $.ajax({
      url: '/script/names/' + _userid,
      success: (res) => {
        if (res.success) {
          let list = res.list
          _remote_list = list
          if (list.length === 0) {
            $('#remote_load_list').html('No saves available')
          } else {
            $('#remote_load_list').html('')
            for (let i = 0; i < list.length; i++) {
              $('#remote_load_list').append(_load_list_add(i,
                                list[i].name, list[i].date, 'remote_load', 'remote_delete'))
            }
          }
        } else {
          alert(res.message)
        }
      },
      error: () => {
        alert('Failed to find server')
      }
    })
  }
  function _local_load_list () {
    $('#local_load_list').html('')
    for (let key in localStorage) {
      if (key.startsWith(PREFIX)) {
        let name = key.slice(PREFIX.length)
        $('#local_load_list').append(_load_list_add(key,
                    name, '', 'local_load', 'local_delete'))
      }
    }
    if ($('#local_load_list').html() === '') {
      $('#local_load_list').html('No saves available')
    }
  }
  function _showXml (xmlText) {
    if (xmlText) {
      xmlDom = Blockly.Xml.textToDom(xmlText)
      Blockly.Xml.domToWorkspace(xmlDom, Blockly.mainWorkspace)
      Blockly.mainWorkspace.scrollCenter()
    } else {
      alert('Corrupted file\n' + xmlText)
    }
  }
  function _load_list_add (id, name, date, fn_name, del_fn_name) {
    let result = '<div class="row"><div class="col-sm-1"> </div>' +
            '<a class="list-group-item col-md-5" onclick="index.' +
            fn_name + '(\'' + id + '\')">' + name + '</a>' +
            '<div class="col-sm-4">' + date + '</div>' +
            '<a class="list-group-item col-sm-1 glyphicon glyphicon-remove-sign" onclick="index.' +
            del_fn_name + '(\'' + id + '\')"></a>' +
            '<div class="col-sm-1"> </div>' +
            '</div>\n'
    return result
  }
  function _file_list_add (file_name, path, fn_name, block_id, widget_id) {
    let result = '<div class="row"><div class="col-sm-1"> </div>' +
            '<a class="list-group-item col-md-5" onclick="index.' +
            `${fn_name}('${path}${file_name}', `
    if (block_id == null) {
      result += 'null'
    } else {
      result += `'${block_id}'`
    }
    result += `, '${widget_id}')">${file_name}</a>` +
            '</div>\n'
    return result
  }
  function _folder_list_add (folder_name, media, path, block_id, widget_id) {
    let result = '<div class="row"><div class="col-sm-1"> </div>' +
            '<a class="list-group-item col-md-5" onclick="index.' +
                `handle_folder_selected('${media}', `
    if (block_id == null) {
      result += 'null'
    } else {
      result += `'${block_id}'`
    }
    result += `, '${widget_id}', '${path}')">&#x1f5c1; ${folder_name}</a>` +
            '</div>\n'
    return result
  }
  function _getXml () {
    let xmlDom = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)
    return Blockly.Xml.domToPrettyText(xmlDom)
  }
  ;
})()
