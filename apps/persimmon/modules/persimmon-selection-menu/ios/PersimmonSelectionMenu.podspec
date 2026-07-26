require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PersimmonSelectionMenu'
  s.version        = package['version']
  s.summary        = 'Native text selection edit menu for Persimmon'
  s.description    = 'Presents the system edit menu for text selected by the Skia reader.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Persimmon'
  s.homepage       = 'https://github.com/chihumyum/Persimmon'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
